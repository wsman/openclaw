/**
 * Discovery API路由模块
 * Phase 1D: Biological Perception - REST API for mDNS node status
 * 
 * 宪法依据：
 * - §306 零停机协议：API端点必须健壮可靠
 * - §110 协作效率：高效的状态查询接口
 * 
 * 提供以下端点：
 * - GET /api/discovery/nodes - 获取所有发现的节点状态
 * - POST /api/discovery/heartbeat - 接收外部心跳请求
 * - WS /api/discovery/updates - 实时状态更新（通过Colyseus实现）
 */

import express from 'express';
import { logger } from '../utils/logger';
import { MDNSDiscoverer } from '../discovery/mdns/MDNSDiscoverer';
import { ServiceInfo } from '../discovery/types/ServiceInfo';

/**
 * 全局MDNSDiscoverer实例引用
 * 由server/index.ts初始化后设置
 */
let discoverer: MDNSDiscoverer | null = null;

type DiscovererProvider = MDNSDiscoverer | null | (() => MDNSDiscoverer | null);

function resolveDiscoverer(provider?: DiscovererProvider): MDNSDiscoverer | null {
  if (!provider) {
    return discoverer;
  }

  return typeof provider === 'function' ? provider() : provider;
}

/**
 * 设置MDNSDiscoverer实例
 * @param instance MDNSDiscoverer实例
 */
export function setDiscoverer(instance: MDNSDiscoverer): void {
  discoverer = instance;
  logger.info('[Discovery API] MDNSDiscoverer已连接');
}

export function createDiscoveryRouter(provider?: DiscovererProvider) {
  const router = express.Router();

/**
 * GET /api/discovery/nodes
 * 获取所有发现的节点状态
 * 
 * 查询参数：
 * - status: 过滤状态 (active|offline|all，默认all)
 * - connectionStatus: 过滤连接状态 (good|degraded|lost|all，默认all)
 */
router.get('/nodes', (req, res) => {
  try {
    const instance = resolveDiscoverer(provider);
    if (!instance) {
      return res.status(503).json({
        error: 'MDNS服务未就绪',
        message: 'mDNS发现服务尚未初始化'
      });
    }

    const { status = 'all', connectionStatus = 'all' } = req.query;
    
    let services = instance.getServices();
    
    // 过滤状态
    if (status !== 'all') {
      services = services.filter(s => s.status === status);
    }
    
    // 过滤连接状态
    if (connectionStatus !== 'all') {
      services = services.filter(s => s.connectionStatus === connectionStatus);
    }

    // 计算统计信息
    const total = services.length;
    const active = services.filter(s => s.status === 'active').length;
    const offline = services.filter(s => s.status === 'offline').length;
    const degraded = services.filter(s => s.connectionStatus === 'degraded').length;
    const good = services.filter(s => s.connectionStatus === 'good').length;

    res.json({
      success: true,
      timestamp: Date.now(),
      nodes: services.map(service => ({
        id: service.id,
        name: service.name,
        type: service.type,
        host: service.host,
        port: service.port,
        protocol: service.protocol,
        lastSeen: service.lastSeen,
        status: service.status,
        rtt: service.rtt,
        connectionStatus: service.connectionStatus,
        // 计算健康评分
        healthScore: calculateHealthScore(service),
        // 元数据
        metadata: service.txt
      })),
      statistics: {
        total,
        active,
        offline,
        connection: {
          good,
          degraded,
          lost: total - good - degraded
        }
      }
    });
  } catch (error) {
    logger.error('[Discovery API] 获取节点列表失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/discovery/nodes/:id
 * 获取特定节点的详细信息
 */
router.get('/nodes/:id', (req, res) => {
  try {
    const instance = resolveDiscoverer(provider);
    if (!instance) {
      return res.status(503).json({
        error: 'MDNS服务未就绪'
      });
    }

    const { id } = req.params;
    const services = instance.getServices();
    const service = services.find(s => s.id === id);

    if (!service) {
      return res.status(404).json({
        error: '节点未找到',
        message: `节点ID ${id} 不存在或已离线`
      });
    }

    // 计算节点健康详情
    const now = Date.now();
    const timeSinceLastSeen = service.lastSeen ? now - service.lastSeen : Infinity;

    res.json({
      success: true,
      timestamp: now,
      node: {
        ...service,
        healthDetails: {
          timeSinceLastSeen,
          healthScore: calculateHealthScore(service),
          recommendations: generateHealthRecommendations(service)
        }
      }
    });
  } catch (error) {
    logger.error('[Discovery API] 获取节点详情失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/discovery/heartbeat
 * 接收外部心跳请求（用于非mDNS节点的手动心跳）
 * 
 * 请求体：
 * {
 *   nodeId: string;
 *   role: string;
 *   capabilities: string[];
 *   load: number; // 0-100%
 *   rtt?: number;
 * }
 */
router.post('/heartbeat', (req, res) => {
  try {
    const { nodeId, role, capabilities, load, rtt } = req.body;

    // 验证必需字段
    if (!nodeId || !role) {
      return res.status(400).json({
        error: '请求参数不完整',
        message: '必需字段: nodeId, role'
      });
    }

    // 验证load范围
    if (load !== undefined && (load < 0 || load > 100)) {
      return res.status(400).json({
        error: '无效的负载值',
        message: 'load必须在0-100之间'
      });
    }

    const instance = resolveDiscoverer(provider);
    if (!instance) {
      return res.status(503).json({
        error: 'MDNS服务未就绪'
      });
    }

    const now = Date.now();

    // 构造或更新ServiceInfo
    const serviceInfo: ServiceInfo = {
      id: nodeId,
      name: role,
      type: 'manual', // 手动心跳类型
      host: req.ip || 'unknown',
      port: 0,
      protocol: 'tcp',
      lastSeen: now,
      status: 'active',
      rtt: rtt,
      connectionStatus: rtt && rtt > 200 ? 'degraded' : 'good',
      role,
      capabilities,
      txt: {
        role,
        load: load?.toString() || '0',
        capabilities: capabilities?.join(',') || '',
        source: 'manual_heartbeat'
      }
    };

    instance.upsertManualService(serviceInfo);

    logger.info(`[Discovery API] 收到手动心跳: ${nodeId}, RTT: ${rtt}ms, 负载: ${load}%`);

    res.json({
      success: true,
      timestamp: now,
      message: '心跳已接收',
      node: serviceInfo
    });
  } catch (error) {
    logger.error('[Discovery API] 处理心跳失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/discovery/stats
 * 获取发现服务统计信息
 */
router.get('/stats', (req, res) => {
  try {
    const instance = resolveDiscoverer(provider);
    if (!instance) {
      return res.status(503).json({
        error: 'MDNS服务未就绪'
      });
    }

    const services = instance.getServices();
    const now = Date.now();

    const stats = {
      timestamp: now,
      uptime: process.uptime(),
      totalNodes: services.length,
      activeNodes: services.filter(s => s.status === 'active').length,
      offlineNodes: services.filter(s => s.status === 'offline').length,
      avgRTT: services.length > 0 
        ? services.reduce((sum, s) => sum + (s.rtt || 0), 0) / services.length 
        : 0,
      connectionDistribution: {
        good: services.filter(s => s.connectionStatus === 'good').length,
        degraded: services.filter(s => s.connectionStatus === 'degraded').length,
        lost: services.filter(s => s.connectionStatus === 'lost').length
      },
      recentActivity: services
        .filter(s => s.lastSeen && now - s.lastSeen < 60000) // 最近1分钟
        .map(s => ({
          id: s.id,
          name: s.name,
          lastSeen: s.lastSeen,
          secondsAgo: Math.floor((now - (s.lastSeen || 0)) / 1000)
        }))
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('[Discovery API] 获取统计信息失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: (error as Error).message
    });
  }
});

  return router;
}

/**
 * 计算健康评分 (0-100)
 */
function calculateHealthScore(service: ServiceInfo): number {
  let score = 100;

  // RTT影响
  if (service.rtt) {
    if (service.rtt > 500) score -= 40;
    else if (service.rtt > 200) score -= 20;
    else if (service.rtt > 100) score -= 10;
  }

  // 连接状态影响
  if (service.connectionStatus === 'lost') score = 0;
  else if (service.connectionStatus === 'degraded') score = Math.max(score - 30, 50);

  // 状态影响
  if (service.status === 'offline') score = 0;
  else if (service.status === 'inactive') score = Math.max(score - 20, 70);

  return Math.max(0, Math.min(100, score));
}

/**
 * 生成健康建议
 */
function generateHealthRecommendations(service: ServiceInfo): string[] {
  const recommendations: string[] = [];

  if (service.status === 'offline') {
    recommendations.push('节点已离线，请检查网络连接');
  } else if (service.connectionStatus === 'lost') {
    recommendations.push('连接已丢失，可能存在网络问题');
  }

  if (service.rtt && service.rtt > 200) {
    recommendations.push(`响应时间较高 (${service.rtt}ms)，建议检查网络延迟`);
  }

  if (service.connectionStatus === 'degraded') {
    recommendations.push('连接状态降级，建议优化网络配置');
  }

  return recommendations.length > 0 ? recommendations : ['节点状态正常'];
}

const router = createDiscoveryRouter();

export default router;
