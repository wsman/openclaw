import 'reflect-metadata';
import express from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server } from 'colyseus';
import { matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { ChatRoom } from '../rooms/ChatRoom';
import { ControlRoom } from '../rooms/ControlRoom';
import { AgentRoom } from '../rooms/AgentRoom';
import { NodeRoom } from '../rooms/NodeRoom';
import { CronRoom } from '../rooms/CronRoom';
import { ConfigRoom } from '../rooms/ConfigRoom';
import { TaskRoom } from '../rooms/TaskRoom';
import { AuthorityRoom } from '../rooms/AuthorityRoom';
import { logger } from '../utils/logger';
import { integrateAgentEngine } from '../gateway/agent-engine';
import { createOpenClawRouter } from '../api/openclaw';
import { MDNSDiscoverer } from '../discovery/mdns/MDNSDiscoverer';
import { createDiscoveryRouter, setDiscoverer } from '../api/discovery';
import { DiscoveryOptions } from '../discovery/types/ServiceInfo';
import { ClusterNode, ClusterNodeOptions } from '../cluster/ClusterNode';
import { ClusterTaskDispatcher } from '../cluster/ClusterTaskDispatcher';
import { TaskLeaseManager } from '../cluster/TaskLeaseManager';
import { createClusterApiRouter } from '../api/cluster';
import { createInternalClusterRouter } from '../api/internal/cluster';
import { createInternalApiRouter as createOpenClawDecisionInternalRouter } from '../gateway/openclaw-decision/api/internal-api';
import { WebSocketClusterBroadcaster } from '../cluster/websocket';
import clusterWsRouter from '../api/cluster-ws';
import { GatewayWebSocketHandler } from '../gateway/websocket-handler';
import { activeRooms } from '../runtime/activeRooms';
import { getAuthorityRuntime, getAuthoritySnapshot, initializeAuthorityRuntime } from '../runtime/authorityRuntime';

type Maybe<T> = T | undefined;
let colyseusShutdownPromise: Promise<void> | null = null;

export interface NegentropyServerOptions {
  port?: number;
  host?: string;
  nodeEnv?: string;
  autoStart?: boolean;
  registerSignalHandlers?: boolean;
  discovery?: {
    enabled?: boolean;
    options?: Partial<DiscoveryOptions>;
  };
  cluster?: ({
    enabled?: boolean;
  } & Partial<Omit<ClusterNodeOptions, 'nodeId' | 'clusterId' | 'name' | 'httpPort'>>) | undefined;
  integrations?: {
    agentEngine?: boolean;
    openClawHook?: boolean;
    openClawDecision?: boolean;
    colyseusMonitor?: boolean;
  };
}

export interface NegentropyServerInstance {
  app: express.Express;
  httpServer: HttpServer;
  gameServer: Server;
  mdnsDiscoverer: MDNSDiscoverer | null;
  clusterNode: ClusterNode | null;
  taskDispatcher: ClusterTaskDispatcher | null;
  taskLeaseManager: TaskLeaseManager | null;
  start(): Promise<void>;
  stop(): Promise<void>;
}

function waitForListen(server: HttpServer, port: number, host: Maybe<string>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
          resolve();
          return;
        }
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function getUpgradePathname(requestUrl?: string): string {
  const value = requestUrl || '/';
  const queryIndex = value.indexOf('?');
  return queryIndex >= 0 ? value.slice(0, queryIndex) : value;
}

export async function createNegentropyServer(options: NegentropyServerOptions = {}): Promise<NegentropyServerInstance> {
  initializeAuthorityRuntime();
  const port = options.port ?? Number(process.env.PORT || 3000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const nodeId = process.env.NODE_ID || `gateway-${port}`;
  const clusterId = process.env.CLUSTER_ID || 'negentropy-lan';
  const clusterEnabled = options.cluster?.enabled !== false;
  const discoveryEnabled = options.discovery?.enabled !== false;
  const clusterToken = options.cluster?.clusterToken || process.env.CLUSTER_TOKEN || undefined;

  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    hsts: false,
    referrerPolicy: false,
    hidePoweredBy: true,
  }));

  app.use(cors({
    origin(origin, callback) {
      if (nodeEnv === 'development') {
        callback(null, true);
        return;
      }

      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:4514',
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS policy violation'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cluster-Token'],
  }));

  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use((req, _res, next) => {
    logger.debug(`[璇锋眰璋冭瘯] ${req.method} ${req.path} - 鐢ㄦ埛浠ｇ悊: ${req.get('User-Agent') || '鏈煡'}`);
    next();
  });

  if (nodeEnv === 'development' && options.integrations?.colyseusMonitor !== false) {
    app.use('/colyseus', monitor());
    logger.info('[Server] Colyseus鐩戞帶闈㈡澘鍚敤: /colyseus');
  }

  const discoveryOptions: DiscoveryOptions = {
    id: nodeId,
    name: options.discovery?.options?.name || 'gateway-node',
    role: options.discovery?.options?.role || 'gateway',
    serviceType: options.discovery?.options?.serviceType || '_http._tcp.local',
    port,
    host: options.discovery?.options?.host || process.env.LAN_IP || host,
    wsPort: options.discovery?.options?.wsPort || port,
    rpcPort: options.discovery?.options?.rpcPort || port,
    clusterId,
    version: options.discovery?.options?.version || '1.0.0',
    capabilities: options.discovery?.options?.capabilities
      || options.cluster?.capabilities
      || ['gateway', 'echo', 'cluster'],
    metadata: options.discovery?.options?.metadata || {},
  };

  const mdnsDiscoverer = discoveryEnabled ? new MDNSDiscoverer(discoveryOptions) : null;
  if (mdnsDiscoverer) {
    setDiscoverer(mdnsDiscoverer);
  }

  const httpServer = createServer(app);
  const gameTransport = new WebSocketTransport({
    server: httpServer,
    maxPayload: 10 * 1024 * 1024,
  });
  const gameTransportWss = (gameTransport as any).wss;
  if (typeof gameTransportWss?._removeListeners === 'function') {
    gameTransportWss._removeListeners();
    gameTransportWss._removeListeners = () => {};
  }
  const colyseusUpgradeListener = (req: Parameters<HttpServer['emit']>[1], socket: any, head: Buffer) => {
    const upgradeHeader = req.headers.upgrade;
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return;
    }

    if (getUpgradePathname(req.url) === '/gateway') {
      return;
    }

    try {
      gameTransportWss.handleUpgrade(req, socket, head, (ws: any) => {
        gameTransportWss.emit('connection', ws, req);
      });
    } catch (error: any) {
      logger.error(`[Server] Colyseus WebSocket鍗囩骇澶辫触: ${error?.message || 'unknown error'}`);
      if (socket && typeof socket.destroy === 'function') {
        socket.destroy();
      }
    }
  };
  httpServer.on('upgrade', colyseusUpgradeListener);
  const gameServer = new Server({
    gracefullyShutdown: false,
    transport: gameTransport,
  });

  gameServer.define('chat_room', ChatRoom);
  gameServer.define('control', ControlRoom);
  gameServer.define('agent', AgentRoom);
  gameServer.define('node', NodeRoom);
  gameServer.define('cron', CronRoom);
  gameServer.define('config', ConfigRoom);
  gameServer.define('task', TaskRoom);
  gameServer.define('authority', AuthorityRoom);

  let clusterNode: ClusterNode | null = null;
  let taskDispatcher: ClusterTaskDispatcher | null = null;
  let taskLeaseManager: TaskLeaseManager | null = null;
  let wsHandler: GatewayWebSocketHandler | null = null;
  let wsClusterBroadcaster: WebSocketClusterBroadcaster | null = null;
  let agentEngineIntegration: ReturnType<typeof integrateAgentEngine> | null = null;

  if (clusterEnabled) {
    clusterNode = new ClusterNode({
      nodeId,
      clusterId,
      name: process.env.NODE_NAME || `${discoveryOptions.name}-${port}`,
      role: options.cluster?.role || 'gateway',
      host: process.env.LAN_IP || options.cluster?.host || discoveryOptions.host,
      httpPort: port,
      wsPort: options.cluster?.wsPort || port,
      rpcPort: options.cluster?.rpcPort || port,
      capabilities: options.cluster?.capabilities || ['gateway', 'echo', 'cluster'],
      version: options.cluster?.version || '1.0.0',
      metadata: options.cluster?.metadata,
      heartbeatIntervalMs: options.cluster?.heartbeatIntervalMs,
      nodeTtlMs: options.cluster?.nodeTtlMs,
      peerRequestTimeoutMs: options.cluster?.peerRequestTimeoutMs,
      clusterToken,
      seedPeers: options.cluster?.seedPeers,
      backplane: options.cluster?.backplane,
      redis: options.cluster?.redis,
      discoverer: mdnsDiscoverer,
    });

    taskDispatcher = new ClusterTaskDispatcher(
      () => clusterNode!.getLocalNode(),
      () => clusterNode!.getTopology(),
    );
    taskLeaseManager = new TaskLeaseManager(clusterNode.getBackplane());
  }

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'Negentropy-Lab Chat System',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      nodeEnv,
      nodeId,
      cluster: clusterNode ? {
        enabled: true,
        clusterId,
        coordinationMode: clusterNode.getCoordinationMode(),
        nodeCount: clusterNode.getTopology().length,
      } : {
        enabled: false,
      },
      features: {
        chat: true,
        agents: true,
        websocket: true,
        realtime: true,
        cluster: Boolean(clusterNode),
        authority: true,
        governance: true,
        collaboration: true,
        replication: true,
        monitoring: true,
        liveScenarios: true,
      },
    });
  });

  app.get('/api/info', (_req, res) => {
    res.json({
      name: 'Negentropy-Lab',
      description: 'Multi-agent collaboration and control system',
      version: '1.0.0',
      nodeId,
      clusterId,
      constitution: {
        basic_law: 'v1.0.0',
        agent_system: '4涓撲笟Agent',
        features: ['realtime-chat', 'multi-agent-collaboration', 'control-room', 'config-management', 'task-scheduling', 'lan-bootstrap'],
      },
      endpoints: {
        websocket: [
          `/chat_room`,
          `/control`,
          `/agent`,
          `/node`,
          `/cron`,
          `/config`,
          `/task`,
          `/authority`,
        ],
        health: `/health`,
        info: `/api/info`,
        agent_status: `/api/agents/status`,
        authority: `/api/authority/state`,
        cluster: clusterNode ? `/api/cluster/*` : undefined,
      },
    });
  });

  app.get('/api/authority/state', (_req, res) => {
    res.json({
      authority: getAuthoritySnapshot(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/authority/monitoring', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      ...runtime.monitoringService.getSnapshot(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/authority/ops', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      ...runtime.monitoringService.getOpsReport(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/authority/cluster/status', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      ok: true,
      cluster: runtime.clusterCoordinationService.getSnapshot(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/cluster/sync', async (_req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const cluster = await runtime.clusterCoordinationService.triggerSync();
      res.json({
        ok: true,
        cluster,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/cluster/recommend-node', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const recommendation = runtime.clusterCoordinationService.recommendNode({
        serviceGroup: typeof req.body?.serviceGroup === 'string' ? req.body.serviceGroup : undefined,
        preferredRegion: typeof req.body?.preferredRegion === 'string' ? req.body.preferredRegion : undefined,
        requireLeader: req.body?.requireLeader === true,
        requiredCapabilities: Array.isArray(req.body?.requiredCapabilities)
          ? req.body.requiredCapabilities.map((value: unknown) => String(value))
          : undefined,
      });
      res.json({
        ok: true,
        recommendation,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/authority/agents/sessions', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      sessions: runtime.agentSessionRegistry.listSessions(),
      total: runtime.state.agents.size,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/agents/sync-live', (_req, res) => {
    if (!agentEngineIntegration) {
      res.status(503).json({
        ok: false,
        error: 'agent engine integration unavailable',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const runtime = getAuthorityRuntime();
    res.json({
      ok: true,
      sync: runtime.liveScenarioService.syncFromAgentSource(agentEngineIntegration.getEngine(), 'http.authority.live_sync'),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/agents/register', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const session = runtime.agentSessionRegistry.registerSession({
        agentId: String(req.body?.agentId || ''),
        name: String(req.body?.name || req.body?.agentId || ''),
        department: String(req.body?.department || 'OFFICE'),
        role: String(req.body?.role || 'worker'),
        model: String(req.body?.model || ''),
        provider: String(req.body?.provider || ''),
        capabilities: Array.isArray(req.body?.capabilities) ? req.body.capabilities : [],
        trustLevel: Number(req.body?.trustLevel || 0.5),
        lane: String(req.body?.lane || 'default'),
        sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
        sessionToken: typeof req.body?.sessionToken === 'string' ? req.body.sessionToken : undefined,
        capacity: Number(req.body?.capacity || 1),
        metadata: req.body?.metadata || {},
      }, 'http.authority');
      res.status(201).json({
        ok: true,
        session,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/agents/:agentId/heartbeat', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const session = runtime.agentSessionRegistry.heartbeat({
        agentId: String(req.params.agentId),
        sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
        load: Number(req.body?.load ?? 0),
        pendingTasks: Number(req.body?.pendingTasks ?? 0),
        healthStatus: req.body?.healthStatus,
        metadata: req.body?.metadata || {},
      }, 'http.authority');
      res.json({
        ok: true,
        session,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.delete('/api/authority/agents/:agentId', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const session = runtime.agentSessionRegistry.unregisterSession(
        String(req.params.agentId),
        'http.authority',
        String(req.body?.reason || 'manual'),
      );
      res.json({
        ok: true,
        session,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/agents/select', (req, res) => {
    const runtime = getAuthorityRuntime();
    const selected = runtime.agentSessionRegistry.selectAgent(
      Array.isArray(req.body?.requiredCapabilities) ? req.body.requiredCapabilities : [],
      typeof req.body?.department === 'string' ? req.body.department : undefined,
    );
    res.json({
      selected,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/authority/tools', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      tools: runtime.toolCallBridge.getToolCatalog(),
      usage: runtime.toolCallBridge.getUsageSnapshot(),
      mcpServices: runtime.mcpTransportService.listServices(),
      activeCalls: runtime.state.tools.activeCalls.size,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/authority/tools/discovery', (req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      tools: runtime.toolCallBridge.discoverTools({
        agentId: typeof req.query?.agentId === 'string' ? req.query.agentId : undefined,
        department: typeof req.query?.department === 'string' ? req.query.department : undefined,
        capability: typeof req.query?.capability === 'string' ? req.query.capability : undefined,
        protocol: req.query?.protocol === 'mcp' || req.query?.protocol === 'builtin'
          ? req.query.protocol
          : undefined,
        tag: typeof req.query?.tag === 'string' ? req.query.tag : undefined,
      }),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/authority/tools/usage', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      usage: runtime.toolCallBridge.getUsageSnapshot(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/authority/tools/mcp/services', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      services: runtime.mcpTransportService.listServices(),
      polling: runtime.mcpTransportService.getPollingStatus(),
      maintenance: runtime.mcpTransportService.getMaintenanceStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/tools/mcp/services/register', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const snapshot = await runtime.mcpTransportService.registerService({
        serviceId: String(req.body?.serviceId || ''),
        provider: String(req.body?.provider || 'mcp'),
        transport: req.body?.transport === 'http' ? 'http' : 'stdio-subprocess',
        command: typeof req.body?.command === 'string' ? req.body.command : undefined,
        args: Array.isArray(req.body?.args) ? req.body.args.map((arg: unknown) => String(arg)) : undefined,
        endpoint: typeof req.body?.endpoint === 'string' ? req.body.endpoint : undefined,
        auth: req.body?.auth && typeof req.body.auth === 'object'
          ? {
              type: req.body.auth.type === 'bearer' || req.body.auth.type === 'api-key' ? req.body.auth.type : 'none',
              token: typeof req.body.auth.token === 'string' ? req.body.auth.token : undefined,
              headerName: typeof req.body.auth.headerName === 'string' ? req.body.auth.headerName : undefined,
            }
          : undefined,
        enabled: req.body?.enabled !== false,
        source: typeof req.body?.source === 'string' ? req.body.source : 'manual',
        modules: Array.isArray(req.body?.modules) ? req.body.modules.map((value: unknown) => String(value)) : ['resources'],
        operationalMode: req.body?.operationalMode === 'paused' || req.body?.operationalMode === 'isolated'
          ? req.body.operationalMode
          : 'active',
        priority: Number.isFinite(Number(req.body?.priority)) ? Number(req.body.priority) : undefined,
        failureThreshold: Number.isFinite(Number(req.body?.failureThreshold)) ? Number(req.body.failureThreshold) : undefined,
        recoveryIntervalMs: Number.isFinite(Number(req.body?.recoveryIntervalMs)) ? Number(req.body.recoveryIntervalMs) : undefined,
        pollingIntervalMs: Number.isFinite(Number(req.body?.pollingIntervalMs)) ? Number(req.body.pollingIntervalMs) : undefined,
        recoverySuccessThreshold: Number.isFinite(Number(req.body?.recoverySuccessThreshold))
          ? Number(req.body.recoverySuccessThreshold)
          : undefined,
        maintenanceWindows: Array.isArray(req.body?.maintenanceWindows)
          ? req.body.maintenanceWindows
          : undefined,
        slo: req.body?.slo && typeof req.body.slo === 'object'
          ? req.body.slo
          : undefined,
        traffic: req.body?.traffic && typeof req.body.traffic === 'object'
          ? req.body.traffic
          : undefined,
        failback: req.body?.failback && typeof req.body.failback === 'object'
          ? req.body.failback
          : undefined,
        orchestration: req.body?.orchestration && typeof req.body.orchestration === 'object'
          ? req.body.orchestration
          : undefined,
        defaultAllowedDepartments: Array.isArray(req.body?.defaultAllowedDepartments)
          ? req.body.defaultAllowedDepartments.map((value: unknown) => String(value))
          : undefined,
        defaultRequiredCapabilities: Array.isArray(req.body?.defaultRequiredCapabilities)
          ? req.body.defaultRequiredCapabilities.map((value: unknown) => String(value))
          : undefined,
        tags: Array.isArray(req.body?.tags) ? req.body.tags.map((value: unknown) => String(value)) : undefined,
        toolPolicies: req.body?.toolPolicies && typeof req.body.toolPolicies === 'object'
          ? req.body.toolPolicies
          : undefined,
      });
      res.status(201).json({
        ok: true,
        service: snapshot,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/tools/mcp/discover', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const discovery = await runtime.mcpTransportService.discoverAndSync(
        typeof req.body?.serviceId === 'string' ? req.body.serviceId : undefined,
      );
      res.json({
        ok: true,
        discovery,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/tools/mcp/polling/trigger', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const services = await runtime.mcpTransportService.triggerHealthPoll(
        typeof req.body?.serviceId === 'string' ? req.body.serviceId : undefined,
      );
      res.json({
        ok: true,
        services,
        polling: runtime.mcpTransportService.getPollingStatus(),
        maintenance: runtime.mcpTransportService.getMaintenanceStatus(),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/tools/mcp/services/:serviceId/health-check', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const services = await runtime.mcpTransportService.checkHealth(String(req.params.serviceId || ''));
      res.json({
        ok: true,
        services,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/tools/mcp/services/:serviceId/control', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const action =
        req.body?.action === 'enable' ||
        req.body?.action === 'disable' ||
        req.body?.action === 'pause' ||
        req.body?.action === 'resume' ||
        req.body?.action === 'isolate' ||
        req.body?.action === 'activate'
          ? req.body.action
          : 'resume';
      const service = await runtime.mcpTransportService.controlService(
        String(req.params.serviceId || ''),
        action,
        typeof req.body?.reason === 'string' ? req.body.reason : undefined,
      );
      res.json({
        ok: true,
        service,
        polling: runtime.mcpTransportService.getPollingStatus(),
        maintenance: runtime.mcpTransportService.getMaintenanceStatus(),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/tools/mcp/services/:serviceId/windows', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const service = await runtime.mcpTransportService.scheduleMaintenanceWindow(
        String(req.params.serviceId || ''),
        {
          windowId: typeof req.body?.windowId === 'string' ? req.body.windowId : '',
          startAt: req.body?.startAt,
          endAt: req.body?.endAt,
          recurrence:
            req.body?.recurrence === 'daily' ||
            req.body?.recurrence === 'weekly' ||
            req.body?.recurrence === 'monthly'
              ? req.body.recurrence
              : 'none',
          action:
            req.body?.action === 'disable' || req.body?.action === 'isolate'
              ? req.body.action
              : 'pause',
          autoRecover: req.body?.autoRecover !== false,
          reason: typeof req.body?.reason === 'string' ? req.body.reason : '',
          enabled: req.body?.enabled !== false,
          priority: Number.isFinite(Number(req.body?.priority)) ? Number(req.body.priority) : 0,
          conflictPolicy:
            req.body?.conflictPolicy === 'defer' ||
            req.body?.conflictPolicy === 'replace' ||
            req.body?.conflictPolicy === 'reject'
              ? req.body.conflictPolicy
              : 'merge',
        },
      );
      res.status(201).json({
        ok: true,
        service,
        maintenance: runtime.mcpTransportService.getMaintenanceStatus(),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.delete('/api/authority/tools/mcp/services/:serviceId/windows/:windowId', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const service = await runtime.mcpTransportService.removeMaintenanceWindow(
        String(req.params.serviceId || ''),
        String(req.params.windowId || ''),
      );
      res.json({
        ok: true,
        service,
        maintenance: runtime.mcpTransportService.getMaintenanceStatus(),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/tools/mcp/services/:serviceId/policy', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const service = await runtime.mcpTransportService.updateServicePolicy(
        String(req.params.serviceId || ''),
        {
          slo: req.body?.slo && typeof req.body.slo === 'object' ? req.body.slo : undefined,
          traffic: req.body?.traffic && typeof req.body.traffic === 'object' ? req.body.traffic : undefined,
          failback: req.body?.failback && typeof req.body.failback === 'object' ? req.body.failback : undefined,
          orchestration:
            req.body?.orchestration && typeof req.body.orchestration === 'object'
              ? req.body.orchestration
              : undefined,
        },
      );
      res.json({
        ok: true,
        service,
        maintenance: runtime.mcpTransportService.getMaintenanceStatus(),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/authority/tools/:toolName/metadata', (req, res) => {
    const runtime = getAuthorityRuntime();
    const toolName = String(req.params.toolName || '');
    const tool = runtime.toolCallBridge.getToolDefinition(toolName);
    if (!tool) {
      res.status(404).json({
        ok: false,
        error: `tool not found: ${toolName}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      ok: true,
      tool,
      access: runtime.toolCallBridge.getAccessDecision(
        toolName,
        typeof req.query?.agentId === 'string' ? req.query.agentId : undefined,
        typeof req.query?.department === 'string' ? req.query.department : undefined,
      ),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/tools/register', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      runtime.toolCallBridge.registerToolDefinition(
        {
          toolName: String(req.body?.toolName || ''),
          source: String(req.body?.source || 'http'),
          category: typeof req.body?.category === 'string' ? req.body.category : undefined,
          protocol: req.body?.protocol === 'mcp' || req.body?.protocol === 'builtin' ? req.body.protocol : undefined,
          version: typeof req.body?.version === 'string' ? req.body.version : undefined,
          provider: typeof req.body?.provider === 'string' ? req.body.provider : undefined,
          allowedDepartments: Array.isArray(req.body?.allowedDepartments) ? req.body.allowedDepartments : ['*'],
          requiredDepartments: Array.isArray(req.body?.requiredDepartments) ? req.body.requiredDepartments : [],
          requiredCapabilities: Array.isArray(req.body?.requiredCapabilities) ? req.body.requiredCapabilities : [],
          approvalMode: req.body?.approvalMode === 'manual' || req.body?.approvalMode === 'denied' || req.body?.approvalMode === 'auto'
            ? req.body.approvalMode
            : undefined,
          quotaKey: typeof req.body?.quotaKey === 'string' ? req.body.quotaKey : undefined,
          quotaLimit: Number.isFinite(Number(req.body?.quotaLimit)) ? Number(req.body.quotaLimit) : undefined,
          tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
          inputSchema: req.body?.inputSchema || {},
          outputSchema: req.body?.outputSchema || {},
          examples: Array.isArray(req.body?.examples) ? req.body.examples : [],
          metadata: req.body?.metadata || {},
        },
        async (args: unknown) => ({ accepted: true, echo: args }),
      );
      res.status(201).json({
        ok: true,
        tool: runtime.toolCallBridge.getToolDefinition(String(req.body?.toolName || '')),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/tools/mcp/register', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const toolName = String(req.body?.toolName || '');
      runtime.toolCallBridge.registerToolDefinition(
        {
          toolName,
          source: String(req.body?.source || 'mcp'),
          provider: String(req.body?.provider || 'mcp'),
          protocol: 'mcp',
          version: typeof req.body?.version === 'string' ? req.body.version : '1.0.0',
          category: typeof req.body?.category === 'string' ? req.body.category : 'application',
          allowedDepartments: Array.isArray(req.body?.allowedDepartments) ? req.body.allowedDepartments : ['*'],
          requiredDepartments: Array.isArray(req.body?.requiredDepartments) ? req.body.requiredDepartments : [],
          requiredCapabilities: Array.isArray(req.body?.requiredCapabilities) ? req.body.requiredCapabilities : [],
          approvalMode: req.body?.approvalMode === 'manual' || req.body?.approvalMode === 'denied' || req.body?.approvalMode === 'auto'
            ? req.body.approvalMode
            : 'auto',
          quotaKey: typeof req.body?.quotaKey === 'string' ? req.body.quotaKey : `tool:${toolName}`,
          quotaLimit: Number.isFinite(Number(req.body?.quotaLimit)) ? Number(req.body.quotaLimit) : undefined,
          tags: Array.isArray(req.body?.tags) ? req.body.tags : ['mcp'],
          inputSchema: req.body?.inputSchema || {},
          outputSchema: req.body?.outputSchema || {},
          examples: Array.isArray(req.body?.examples) ? req.body.examples : [],
          metadata: {
            ...(req.body?.metadata || {}),
            transport: req.body?.transport || 'authority-mock',
          },
        },
        async (args: unknown) => ({
          accepted: true,
          protocol: 'mcp',
          echo: args,
        }),
      );
      res.status(201).json({
        ok: true,
        tool: runtime.toolCallBridge.getToolDefinition(toolName),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/tools/call', async (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const result = await runtime.toolCallBridge.callToolWithContext({
        toolName: String(req.body?.toolName || ''),
        args: req.body?.args,
        agentId: String(req.body?.agentId || 'system'),
        sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
      });
      res.json({
        ok: true,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/authority/governance', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      proposals: runtime.conflictResolver.list(),
      approvals: [...runtime.state.governance.approvals.entries()].reduce<Record<string, boolean>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {}),
      entropy: runtime.entropyEngine.getReport(),
      breaker: runtime.breakerService.evaluate(runtime.entropyEngine.getReport().forecastGlobal),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/governance/conflicts', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      if (req.body?.simulate) {
        const simulation = runtime.conflictResolver.simulate({
          title: String(req.body?.title || ''),
          proposer: String(req.body?.proposer || 'system'),
          department: typeof req.body?.department === 'string' ? req.body.department : undefined,
          type: typeof req.body?.type === 'string' ? req.body.type : undefined,
          options: Array.isArray(req.body?.options) ? req.body.options : [],
          rationale: typeof req.body?.rationale === 'string' ? req.body.rationale : undefined,
          metadata: req.body?.metadata || {},
        });
        res.json({
          ok: true,
          simulation,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const proposal = runtime.conflictResolver.createProposal({
        title: String(req.body?.title || ''),
        proposer: String(req.body?.proposer || 'system'),
        department: typeof req.body?.department === 'string' ? req.body.department : undefined,
        type: typeof req.body?.type === 'string' ? req.body.type : undefined,
        options: Array.isArray(req.body?.options) ? req.body.options : [],
        rationale: typeof req.body?.rationale === 'string' ? req.body.rationale : undefined,
        metadata: req.body?.metadata || {},
      });
      res.status(201).json({
        ok: true,
        proposal,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/governance/conflicts/:proposalId/vote', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const proposal = runtime.conflictResolver.vote({
        proposalId: String(req.params.proposalId),
        voterAgentId: String(req.body?.voterAgentId || ''),
        option: String(req.body?.option || ''),
        rationale: typeof req.body?.rationale === 'string' ? req.body.rationale : undefined,
      });
      res.json({
        ok: true,
        proposal,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/governance/conflicts/:proposalId/resolve', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const proposal = runtime.conflictResolver.resolve(
        String(req.params.proposalId),
        String(req.body?.decider || 'system'),
      );
      res.json({
        ok: true,
        proposal,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/governance/scenarios/budget-conflict', async (req, res) => {
    if (!agentEngineIntegration) {
      res.status(503).json({
        ok: false,
        error: 'agent engine integration unavailable',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const runtime = getAuthorityRuntime();
      const result = await runtime.liveScenarioService.runBudgetConflictScenario(
        agentEngineIntegration.getEngine(),
        {
          title: typeof req.body?.title === 'string' ? req.body.title : undefined,
          proposer: typeof req.body?.proposer === 'string' ? req.body.proposer : undefined,
          department: typeof req.body?.department === 'string' ? req.body.department : undefined,
          requestedAmount: req.body?.requestedAmount,
          options: Array.isArray(req.body?.options) ? req.body.options : undefined,
          rationale: typeof req.body?.rationale === 'string' ? req.body.rationale : undefined,
          topic: typeof req.body?.topic === 'string' ? req.body.topic : undefined,
        },
        'http.authority.live_budget_conflict',
      );
      res.json({
        ok: true,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/workflows/morning-brief', (_req, res) => {
    const runtime = getAuthorityRuntime();
    const brief = runtime.pilotWorkflowService.runMorningBrief('http.authority');
    res.json({
      ok: true,
      brief,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/workflows/morning-brief/live', async (_req, res) => {
    if (!agentEngineIntegration) {
      res.status(503).json({
        ok: false,
        error: 'agent engine integration unavailable',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const runtime = getAuthorityRuntime();
      const result = await runtime.liveScenarioService.runLiveMorningBrief(
        agentEngineIntegration.getEngine(),
        'http.authority.live_morning_brief',
      );
      res.json({
        ok: true,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/workflows/entropy-drill', (_req, res) => {
    const runtime = getAuthorityRuntime();
    const drill = runtime.pilotWorkflowService.runEntropyDrill('http.authority');
    res.json({
      ok: true,
      drill,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/authority/collaboration', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      ...runtime.collaborationBus.getSnapshot(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/collaboration/subscribe', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const subscription = runtime.collaborationBus.subscribe({
        topic: String(req.body?.topic || ''),
        agentId: String(req.body?.agentId || ''),
        requiredCapabilities: Array.isArray(req.body?.requiredCapabilities) ? req.body.requiredCapabilities : [],
      }, 'http.authority');
      res.status(201).json({
        ok: true,
        subscription,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.delete('/api/authority/collaboration/subscriptions/:subscriptionId', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const removed = runtime.collaborationBus.unsubscribe(String(req.params.subscriptionId), 'http.authority');
      res.json({
        ok: true,
        removed,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/collaboration/publish', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const publication = runtime.collaborationBus.publish({
        topic: String(req.body?.topic || ''),
        from: String(req.body?.from || ''),
        payload: req.body?.payload,
        requiredCapabilities: Array.isArray(req.body?.requiredCapabilities) ? req.body.requiredCapabilities : [],
        traceId: typeof req.body?.traceId === 'string' ? req.body.traceId : undefined,
      });
      res.json({
        ok: true,
        ...publication,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/collaboration/direct', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const envelope = runtime.collaborationBus.sendDirect({
        from: String(req.body?.from || ''),
        to: String(req.body?.to || ''),
        payload: req.body?.payload,
        traceId: typeof req.body?.traceId === 'string' ? req.body.traceId : undefined,
      });
      res.json({
        ok: true,
        envelope,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post('/api/authority/collaboration/workflows/:workflowId/bridge', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const publication = runtime.collaborationBus.bridgeWorkflow(
        String(req.params.workflowId),
        String(req.body?.topic || ''),
        req.body?.payload,
        'http.authority',
      );
      res.json({
        ok: true,
        ...publication,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/authority/replication', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      ...runtime.replicationService.getStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/replication/snapshot', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      ok: true,
      snapshot: runtime.replicationService.snapshot(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/replication/recover', (_req, res) => {
    const runtime = getAuthorityRuntime();
    res.json({
      ok: true,
      recovery: runtime.replicationService.recover(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/authority/replication/route-proposal', (req, res) => {
    try {
      const runtime = getAuthorityRuntime();
      const result = runtime.replicationService.routeProposal({
        proposer: String(req.body?.proposer || 'system'),
        targetPath: String(req.body?.targetPath || ''),
        operation: req.body?.operation || 'set',
        payload: req.body?.payload,
        requiredCapabilities: Array.isArray(req.body?.requiredCapabilities) ? req.body.requiredCapabilities : [],
        riskLevel: req.body?.riskLevel || 'low',
        expectedDeltaEntropy: Number(req.body?.expectedDeltaEntropy || 0),
        reason: String(req.body?.reason || 'replication_route_proposal'),
        traceId: typeof req.body?.traceId === 'string' ? req.body.traceId : undefined,
      });
      res.json({
        ok: result.ok,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/agents/status', (_req, res) => {
    const runtime = getAuthorityRuntime();
    const sessions = runtime.agentSessionRegistry.listSessions();
    res.json({
      agents: sessions,
      totalAgents: sessions.length,
      activeAgents: sessions.filter((session) => session.available).length,
      timestamp: new Date().toISOString(),
      clusterNodeId: nodeId,
    });
  });

  app.get('/api/chat/history', (req, res) => {
    const { limit = 50, offset = 0 } = req.query;
    res.json({
      messages: [],
      metadata: {
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
        total: 0,
        hasMore: false,
      },
      note: 'Chat history persistence will be implemented in a later phase.',
    });
  });

  app.get('/api/heartbeat', (_req, res) => {
    res.json({
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
      status: 'alive',
      nodeId,
      clusterId,
    });
  });

  if (mdnsDiscoverer) {
    app.use('/api/discovery', createDiscoveryRouter(() => mdnsDiscoverer));
    logger.info('[Server] Discovery API宸叉敞鍐? /api/discovery/*');
  }

  if (options.integrations?.agentEngine !== false) {
    agentEngineIntegration = integrateAgentEngine(app, {
      enabled: true,
      enableHealthChecks: true,
      maxAgents: 50,
    });
    getAuthorityRuntime().liveScenarioService.syncFromAgentSource(agentEngineIntegration.getEngine(), 'system.live_sync');
    logger.info('[Server] Agent寮曟搸宸查泦鎴? /api/agents/*');
  }

  if (options.integrations?.openClawHook !== false) {
    app.use('/api/hook/openclaw', createOpenClawRouter(null as any));
    logger.info('[Server] OpenClaw Hook API宸叉敞鍐? /api/hook/openclaw');
  }

  if (options.integrations?.openClawDecision !== false) {
    app.use('/internal/openclaw', createOpenClawDecisionInternalRouter());
    logger.info('[Server] OpenClaw Decision 鍐呴儴API宸叉敞鍐? /internal/openclaw/*');
  }

  if (clusterNode && taskDispatcher && taskLeaseManager) {
    app.use('/internal/cluster', createInternalClusterRouter({
      clusterNode,
      taskDispatcher,
      clusterToken,
    }));
    app.use('/api/cluster', createClusterApiRouter({
      clusterNode,
      taskDispatcher,
      taskLeaseManager,
      clusterToken,
    }));
    logger.info('[Server] Cluster API宸叉敞鍐? /api/cluster/*, /internal/cluster/*');

    // 鍒涘缓骞舵寕杞紾atewayWebSocketHandler
    wsHandler = new GatewayWebSocketHandler({
      authManager: undefined, // 浣跨敤榛樿璁よ瘉绠＄悊鍣?
      path: '/gateway',
    });
    wsHandler.attachToServer(httpServer);
    logger.info('[Server] Gateway WebSocket handler attached to HTTP server');

    // 鍒濆鍖朩ebSocket闆嗙兢骞挎挱鍣?
    wsClusterBroadcaster = new WebSocketClusterBroadcaster();
    await wsClusterBroadcaster.initialize(clusterNode, wsHandler);
    logger.info('[Server] WebSocket cluster broadcaster initialized');

    // 娉ㄥ叆鍒癮pp鍜寃sHandler
    app.set('clusterWsBroadcaster', wsClusterBroadcaster);
    wsHandler.setClusterBroadcaster(wsClusterBroadcaster);

    app.use('/api/cluster/websocket', clusterWsRouter);
    logger.info('[Server] WebSocket cluster API registered: /api/cluster/websocket/*');
  }

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        availableEndpoints: ['/health', '/api/info', '/api/agents/status', '/api/chat/history', '/api/heartbeat', '/api/discovery/*', '/api/cluster/*'],
      });
      return;
    }

    res.status(404).json({
        error: 'Page not found (Negentropy-Lab is API-only)',
      path: req.path,
      frontend: {
        migrated: true,
        workspace: '/home/wsman/OpenDoge/opendoge-ui',
        apps: [
          'apps/control-ui-web',
          'apps/control-ui-desk',
          'apps/gateway',
        ],
      },
    });
  });

  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(`[鍏ㄥ眬閿欒澶勭悊] 璺緞: ${req.path}, 閿欒: ${err.message}`);
    if (!res.headersSent) {
      res.status(err.type === 'entity.too.large' ? 413 : 500).json({
        error: err.type === 'entity.too.large' ? '鏂囦欢杩囧ぇ锛岃秴杩囦簡鏈嶅姟鍣ㄩ檺鍒?(鏈€澶?0MB)' : `鏈嶅姟鍣ㄥ唴閮ㄩ敊璇? ${err.message || '鏈煡閿欒'}`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  let started = false;

  const start = async () => {
    if (started) {
      return;
    }

    await waitForListen(httpServer, port, host);
    if (mdnsDiscoverer) {
      await mdnsDiscoverer.start();
      logger.info('[Server] mDNS discovery started');
    }
    if (clusterNode) {
      await clusterNode.start();
      await getAuthorityRuntime().clusterCoordinationService.attach(
        clusterNode,
        taskDispatcher || undefined,
        taskLeaseManager || undefined,
      );
    }

    started = true;
    logger.info('馃殌 Negentropy-Lab 鏈嶅姟鍣ㄥ凡鍚姩');
    logger.info(`馃摗 鍦板潃: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    logger.info(`馃寪 闆嗙兢: ${clusterEnabled ? `${clusterId}/${clusterNode?.getCoordinationMode()}` : 'disabled'}`);
  };

  const stop = async () => {
    if (!started) {
      return;
    }

    if (clusterNode) {
      await getAuthorityRuntime().clusterCoordinationService.detach();
      await clusterNode.stop();
    }
    if (wsClusterBroadcaster) {
      await wsClusterBroadcaster.shutdown();
    }
    if (wsHandler) {
      wsHandler.shutdown('Server shutdown');
      wsHandler = null;
    }
    if (mdnsDiscoverer) {
      mdnsDiscoverer.stop();
    }
    httpServer.off('upgrade', colyseusUpgradeListener);
    if (!colyseusShutdownPromise) {
      const shutdownPromise = matchMaker.isGracefullyShuttingDown
        ? Promise.resolve()
        : gameServer.gracefullyShutdown(false).catch((error) => {
            logger.warn(`[Server] Colyseus浼橀泤鍋滄湇澶辫触: ${String(error)}`);
          });

      colyseusShutdownPromise = shutdownPromise.finally(() => {
        colyseusShutdownPromise = null;
      });
    }
    await colyseusShutdownPromise;
    await closeHttpServer(httpServer);
    activeRooms.clear();
    started = false;
  };

  if (options.registerSignalHandlers !== false) {
    const shutdown = () => {
      void stop()
        .then(() => process.exit(0))
        .catch((error) => {
          logger.error('鍏抽棴鏈嶅姟鍣ㄦ椂鍑洪敊:', error);
          process.exit(1);
        });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  if (options.autoStart !== false) {
    await start();
  }

  return {
    app,
    httpServer,
    gameServer,
    mdnsDiscoverer,
    clusterNode,
    taskDispatcher,
    taskLeaseManager,
    start,
    stop,
  };
}
