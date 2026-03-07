/**
 * 🔍 mDNS服务发现模块 - MDNS Discoverer
 *
 * 宪法依据:
 * - §101 同步公理 - 代码与注解必须原子性同步
 * - §102 熵减原则 - 降低系统熵值，自动化服务发现
 * - §110 协作效率公理 - 5秒心跳间隔，确保服务发现及时性
 * - §306 零停机协议 - 15秒超时阈值，200ms RTT降级阈值
 * - §151 持久化原则 - 服务信息持久化记录
 *
 * 功能:
 * - mDNS服务发布与发现
 * - 服务健康状态监控
 * - 心跳机制（5秒间隔）
 * - 超时检测（15秒阈值）
 *
 * @维护者 科技部
 * @最后更新 2026-02-12
 */

import mdns from 'multicast-dns';
import { EventEmitter } from 'events';
import { ServiceInfo, DiscoveryOptions } from '../types/ServiceInfo';
import { logger } from '../../utils/logger'; // 修正路径: server/discovery/mdns -> server/utils

// §110 Collaboration Efficiency: Heartbeat Interval 5s
const HEARTBEAT_INTERVAL = 5000;
// §306 Zero Downtime: Timeout Threshold 15s
const TIMEOUT_THRESHOLD = 15000;
// §306 Zero Downtime: Degraded Threshold 200ms RTT
const DEGRADED_THRESHOLD = 200;

export class MDNSDiscoverer extends EventEmitter {
    private mdns: any;
    private services: Map<string, ServiceInfo> = new Map();
    private isRunning = false;
    private options: DiscoveryOptions = {};
    private heartbeatTimer: any = null; // Type safety fix
    private timeoutCheckTimer: any = null; // Type safety fix

    constructor(options?: DiscoveryOptions) {
        super();
        this.options = options || {};
        try {
            this.mdns = mdns();
        } catch (error) {
            logger.error(`[Discovery] Failed to initialize mDNS: ${(error as Error).message}`);
        }
    }

    public async start(): Promise<void> {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.setupListeners();
        
        const serviceType = this.options.serviceType || '_http._tcp.local';
        logger.info(`[Discovery] Starting mDNS discovery for ${serviceType}`);
        
        // Initial query
        this.query(serviceType);

        // §110 Collaboration Efficiency: Start Active Heartbeat
        this.startHeartbeat();

        // §306 Zero Downtime: Start Timeout Monitor
        this.startTimeoutsCheck();
    }

    private setupListeners(): void {
        if (!this.mdns) return;

        this.mdns.on('response', (response: any) => {
            this.processResponse(response);
        });
        
        this.mdns.on('error', (error: Error) => {
            logger.error(`[Discovery] mDNS error: ${error.message}`);
        });
    }

    private startHeartbeat(): void {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        
        // Broadcast presence every 5s
        this.heartbeatTimer = setInterval(() => {
            this.broadcastPresence();
        }, HEARTBEAT_INTERVAL);
        
        // Immediate first broadcast
        this.broadcastPresence();
    }

    private broadcastPresence(): void {
        if (!this.mdns) return;

        const serviceName = this.options.name || 'gateway-node';
        const serviceType = this.options.serviceType || '_http._tcp.local';
        const port = this.options.port || 3000;
        
        // Construct standard DNS-SD records
        this.mdns.respond({
            answers: [
                {
                    name: serviceType,
                    type: 'PTR',
                    data: serviceName
                },
                {
                    name: serviceName,
                    type: 'SRV',
                    data: {
                        port: port,
                        weight: 0,
                        priority: 10,
                        target: serviceName // Simple target
                    }
                },
                {
                    name: serviceName,
                    type: 'TXT',
                    data: [
                        `id=${this.options.id || 'unknown'}`,
                        `role=${this.options.role || 'gateway'}`,
                        `status=active`,
                        `timestamp=${Date.now()}` // For RTT calculation
                    ]
                }
            ]
        });
    }

    private startTimeoutsCheck(): void {
        if (this.timeoutCheckTimer) clearInterval(this.timeoutCheckTimer);

        // Check for timeouts every 1s
        this.timeoutCheckTimer = setInterval(() => {
            this.checkTimeouts();
        }, 1000);
    }

    private checkTimeouts(): void {
        const now = Date.now();
        this.services.forEach((service, id) => {
            if (service.status === 'offline') return;

            const timeSinceLastSeen = now - (service.lastSeen || 0);
            
            if (timeSinceLastSeen > TIMEOUT_THRESHOLD) {
                // Mark as offline
                service.status = 'offline';
                service.connectionStatus = 'lost';
                this.services.set(id, service);
                this.emit('service-lost', service);
                logger.warn(`[Discovery] Node ${id} timed out (last seen ${timeSinceLastSeen}ms ago)`);
            }
        });
    }

    private processResponse(response: any): void {
        const answers = [...(response.answers || []), ...(response.additionals || [])];
        const srvRecords = answers.filter((a: any) => a.type === 'SRV');
        
        srvRecords.forEach((srv: any) => {
            const serviceName = srv.name;
            const txtRecord = answers.find((a: any) => a.type === 'TXT' && a.name === serviceName);
            
            // Extract TXT data
            const txtData: Record<string, string> = {};
            if (txtRecord && txtRecord.data) {
                const bufferList = Array.isArray(txtRecord.data) ? txtRecord.data : [txtRecord.data];
                bufferList.forEach((buf: Buffer) => {
                    const str = buf.toString();
                    const splitIndex = str.indexOf('=');
                    if (splitIndex > 0) {
                        const key = str.substring(0, splitIndex);
                        const value = str.substring(splitIndex + 1);
                        txtData[key] = value;
                    }
                });
            }

            const serviceId = txtData.id || serviceName;
            const now = Date.now();
            
            // Calculate RTT (Pseudo-RTT based on timestamp in TXT record)
            let rtt = 0;
            if (txtData.timestamp) {
                const sentTime = parseInt(txtData.timestamp, 10);
                rtt = Math.max(0, now - sentTime);
            }

            // Determine connection status
            let connectionStatus: 'good' | 'degraded' | 'lost' = 'good';
            if (rtt > DEGRADED_THRESHOLD) {
                connectionStatus = 'degraded';
            }

            const service: ServiceInfo = {
                id: serviceId,
                name: serviceName,
                type: 'mdns',
                host: srv.data.target,
                port: srv.data.port,
                protocol: 'tcp',
                addresses: [],
                txt: txtData,
                lastSeen: now,
                status: 'active',
                rtt: rtt,
                connectionStatus: connectionStatus,
                weight: srv.data.weight,
                priority: srv.data.priority,
                ttl: srv.ttl
            };

            if (!this.services.has(serviceId)) {
                this.services.set(serviceId, service);
                this.emit('service-found', service);
                logger.info(`[Discovery] New service found: ${serviceId} (RTT: ${rtt}ms)`);
            } else {
                this.services.set(serviceId, service);
                this.emit('service-updated', service);
            }
        });
    }

    public query(serviceType: string): void {
        if (!this.mdns) return;
        this.mdns.query({
            questions: [{
                name: serviceType,
                type: 'PTR'
            }]
        });
    }

    public stop(): void {
        if (!this.isRunning) return;
        
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.timeoutCheckTimer) clearInterval(this.timeoutCheckTimer);
        
        if (this.mdns) {
            this.mdns.destroy();
        }
        this.isRunning = false;
        this.services.clear();
        logger.info('[Discovery] mDNS discovery stopped');
    }
    
    public getServices(): ServiceInfo[] {
        return Array.from(this.services.values());
    }
}
