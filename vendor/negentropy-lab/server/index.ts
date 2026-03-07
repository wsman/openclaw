import 'reflect-metadata'; // 必须首先导入，用于依赖注入（简化保留）
import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

// 导入房间
import { ChatRoom } from './rooms/ChatRoom';
import { ControlRoom } from './rooms/ControlRoom';
import { AgentRoom } from './rooms/AgentRoom';
import { NodeRoom } from './rooms/NodeRoom';
import { CronRoom } from './rooms/CronRoom';
import { ConfigRoom } from './rooms/ConfigRoom';
import { TaskRoom } from './rooms/TaskRoom';
import { Room } from 'colyseus';

// 导入工具
import { logger } from './utils/logger';

// 导入Agent API (新版本 - 从gateway模块导入)
import { integrateAgentEngine } from './gateway/agent-engine';
import { createOpenClawRouter } from './api/openclaw';
import { authenticateJWT } from './middleware/auth';

// 导入Discovery API (Phase 1D: Biological Perception)
import { MDNSDiscoverer } from './discovery/mdns/MDNSDiscoverer';
import discoveryRouter, { setDiscoverer } from './api/discovery';

// 配置
const port = process.env.PORT || 3000; // 使用3000端口统一配置
const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * 🚀 Negentropy-Lab 服务器入口
 * 简化自 MY-DOGE-DEMO 的复杂服务器配置
 * 
 * 宪法依据：
 * - §101 用户主权公理：服务器设计以用户为中心
 * - §107 通信安全公理：基本的WebSocket安全配置
 * - §321-§324 实时通信公理：Colyseus服务器配置
 * 
 * 简化原则：
 * 1. 移除复杂的依赖注入系统（InversifyJS）
 * 2. 移除Prometheus监控和复杂指标
 * 3. 移除Qdrant向量数据库集成
 * 4. 简化API，只保留聊天相关功能
 * 5. 移除复杂的安全头配置
 * 6. 注册核心控制面房间，支持Gateway能力扩展
 */

// 活跃房间追踪 (用于OpenClaw Hook广播)
export const activeRooms: Set<Room> = new Set();

// 初始化Express应用
const app: express.Application = express();

// === 中间件配置（简化版） ===

// 基础安全头（简化版）
app.use(helmet({
    contentSecurityPolicy: false, // 开发环境简化
    hsts: false, // 禁用强制HTTPS
    referrerPolicy: false,
    hidePoweredBy: true,
}));

// CORS配置（简化，允许所有来源开发环境）
app.use(cors({
    origin: function(origin, callback) {
        // 开发环境允许所有来源
        if (nodeEnv === 'development') {
            callback(null, true);
        } else {
            // 生产环境只允许指定来源
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:4514'
            ];
            
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('CORS policy violation'));
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression()); // 压缩
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ limit: '10mb', extended: true })); // URL编码解析

// === 请求调试中间件 ===
app.use((req, res, next) => {
    logger.debug(`[请求调试] ${req.method} ${req.path} - 用户代理: ${req.get('User-Agent') || '未知'}`);
    next();
});

// Colyseus监控面板（仅开发环境）
if (nodeEnv === 'development') {
    app.use('/colyseus', monitor());
    logger.info('[Server] Colyseus监控面板启用: /colyseus');
}

// === 前端迁移说明 ===
// 注意: Negentropy-Lab 已切换为 API-only 服务。
// 前端统一迁移至 /home/wsman/OpenDoge/opendoge-ui 维护。

// === 初始化MDNSDiscoverer (Phase 1D: Biological Perception) ===
const mdnsDiscoverer = new MDNSDiscoverer({
  id: `gateway-${process.env.NODE_ID || '001'}`,
  name: 'gateway-node',
  role: 'gateway',
  serviceType: '_http._tcp.local',
  port: parseInt(process.env.PORT || '3000', 10)
});

// 设置Discoverer实例供API使用
setDiscoverer(mdnsDiscoverer);

// 启动MDNS发现服务
mdnsDiscoverer.start().catch((error) => {
  logger.error('[Server] 启动MDNS发现服务失败:', error);
});

logger.info('[Server] MDNS发现服务已启动，每5秒心跳广播，15秒超时检测');

// === 基础API端点 ===

/**
 * 健康检查端点
 * 宪法依据：§190 网络韧性公理，服务需提供健康检查
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Negentropy-Lab Chat System',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        nodeEnv: nodeEnv,
        features: {
            chat: true,
            agents: true,
            websocket: true,
            realtime: true
        }
    });
});

/**
 * 系统信息端点
 */
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Negentropy-Lab',
        description: '多Agent协作知识与控制系统',
        version: '1.0.0',
        constitution: {
            basic_law: 'v1.0.0',
            agent_system: '4专业Agent',
            features: ['实时聊天', '多Agent协作', '控制房间', '配置管理', '任务调度']
        },
        endpoints: {
            websocket: [
                `/chat_room`,
                `/control`,
                `/agent`,
                `/node`,
                `/cron`,
                `/config`,
                `/task`
            ],
            health: `/health`,
            info: `/api/info`,
            agent_status: `/api/agents/status`
        }
    });
});

/**
 * Agent状态查询端点
 */
app.get('/api/agents/status', (req, res) => {
    res.json({
        agents: [
            {
                id: 'agent:legal_expert',
                name: '法务专家',
                type: 'legal_expert',
                status: 'active',
                capabilities: ['宪法解释', '合规审查', '规则分析']
            },
            {
                id: 'agent:programmer',
                name: '程序猿',
                type: 'programmer',
                status: 'active',
                capabilities: ['代码生成', '技术支持', '系统集成']
            },
            {
                id: 'agent:architect',
                name: '架构师',
                type: 'architect',
                status: 'active',
                capabilities: ['架构设计', '知识图谱', '系统优化']
            },
            {
                id: 'agent:secretary',
                name: '书记员',
                type: 'secretary',
                status: 'active',
                capabilities: ['历史管理', '摘要生成', '知识提取']
            }
        ],
        totalAgents: 4,
        activeAgents: 4,
        timestamp: new Date().toISOString()
    });
});

/**
 * 聊天消息历史端点（简化版）
 * Phase 2将实现完整的消息存储
 */
app.get('/api/chat/history', (req, res) => {
    const { limit = 50, offset = 0 } = req.query;
    
    res.json({
        messages: [],
        metadata: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: 0,
            hasMore: false
        },
        note: '消息历史功能将在Phase 2中实现完整存储'
    });
});

/**
 * 心跳端点（用于连接测试）
 */
app.get('/api/heartbeat', (req, res) => {
    res.json({
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        status: 'alive'
    });
});

// === Discovery API集成 (Phase 1D: Biological Perception) ===
app.use('/api/discovery', discoveryRouter);
logger.info('[Server] Discovery API已注册: /api/discovery/*');

// === Agent引擎集成 ===
// 集成Agent引擎并注册API路由
const agentIntegration = integrateAgentEngine(app, {
  enabled: true,
  enableHealthChecks: true,
  maxAgents: 50
});
logger.info('[Server] Agent引擎已集成: /api/agents/*');

// === OpenClaw Hook API ===
// 注册OpenClaw Hook API (必须在gameServer创建后，因为需要引用它，或者直接引用activeRooms)
app.use('/api/hook/openclaw', createOpenClawRouter(null as any)); // 我们目前在 openclaw.ts 中只使用了 activeRooms，不需要 gameServer
logger.info('[Server] OpenClaw Hook API已注册: /api/hook/openclaw');

// === OpenClaw Decision 内部 API ===
// 注册决策服务内部管理API
import { createInternalApiRouter } from './gateway/openclaw-decision/api/internal-api';
app.use('/internal/openclaw', createInternalApiRouter());
logger.info('[Server] OpenClaw Decision 内部API已注册: /internal/openclaw/*');

// === LLM API (临时禁用以避免路由冲突) ===
// 暂时注释掉LLM API，以解决静态文件服务冲突
// import { createLLMRouter } from './api/llm';
// app.use('/api/llm', createLLMRouter());
// logger.info('[Server] LLM API已注册: /api/llm');

// 默认路由（如果没有其他匹配）
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({
            error: 'API端点未找到',
            path: req.path,
            availableEndpoints: ['/health', '/api/info', '/api/agents/status', '/api/chat/history', '/api/heartbeat', '/api/discovery/*']
        });
    } else {
        res.status(404).json({
            error: '页面未找到（Negentropy-Lab 已切换为 API-only）',
            path: req.path,
            frontend: {
                migrated: true,
                workspace: '/home/wsman/OpenDoge/opendoge-ui',
                apps: [
                    'apps/control-ui-web',
                    'apps/control-ui-desk',
                    'apps/gateway'
                ]
            },
            availableEndpoints: [
                '/health',
                '/api/info',
                '/api/agents/status',
                '/api/chat/history',
                '/api/heartbeat',
                '/api/discovery/*'
            ]
        });
    }
});

// === 全局错误处理 ===

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error(`[全局错误处理] 路径: ${req.path}, 错误: ${err.message}`);
    
    if (err.stack && nodeEnv === 'development') {
        logger.error(`[堆栈跟踪] ${err.stack}`);
    }

    // 针对负载过大的特殊处理
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ 
            error: '文件过大，超过了服务器限制 (最大10MB)' 
        });
    }

    // 默认返回500错误
    if (!res.headersSent) {
        res.status(500).json({ 
            error: `服务器内部错误: ${err.message || '未知错误'}`,
            timestamp: new Date().toISOString()
        });
    }
});

// === 创建HTTP服务器 ===

const server = createServer(app);

// === 创建Colyseus服务器 ===

const gameServer = new Server({
    transport: new WebSocketTransport({
        server: server,
        maxPayload: 10 * 1024 * 1024 // 10MB最大消息大小
    })
});

// === 注册核心房间 ===

gameServer.define('chat_room', ChatRoom);
gameServer.define('control', ControlRoom);
gameServer.define('agent', AgentRoom);
gameServer.define('node', NodeRoom);
gameServer.define('cron', CronRoom);
gameServer.define('config', ConfigRoom);
gameServer.define('task', TaskRoom);
logger.info('[Server] 核心房间已注册: chat_room/control/agent/node/cron/config/task');

// === 启动服务器 ===

server.listen(port, () => {
    logger.info('🚀 Negentropy-Lab 服务器已启动');
    logger.info(`📡 地址: http://localhost:${port}`);
    logger.info(`💬 聊天房间: ws://localhost:${port}/chat_room`);
    logger.info(`🎛️ 控制房间: ws://localhost:${port}/control`);
    logger.info(`🤖 Agent房间: ws://localhost:${port}/agent`);
    logger.info(`🌐 Node房间: ws://localhost:${port}/node`);
    logger.info(`⏰ Cron房间: ws://localhost:${port}/cron`);
    logger.info(`⚙️ 配置房间: ws://localhost:${port}/config`);
    logger.info(`📋 任务房间: ws://localhost:${port}/task`);
    logger.info(`🏥 健康检查: http://localhost:${port}/health`);
    logger.info(`🛠️  运行模式: ${nodeEnv}`);
    logger.info(`🤖 支持Agent: 4个专业Agent (法务专家、程序猿、架构师、书记员)`);
    
    if (nodeEnv === 'development') {
        logger.info('🔧 开发工具: Colyseus监控面板启用于 /colyseus');
    }
});

// === 优雅关闭处理 ===

const gracefulShutdown = () => {
    logger.info('收到关闭信号，正在优雅关闭服务器...');
    
    server.close(() => {
        logger.info('HTTP服务器已关闭');
        
        // 关闭MDNS发现服务
        mdnsDiscoverer.stop();
        logger.info('MDNS发现服务已停止');
        
        // 关闭Colyseus游戏服务器
        gameServer.gracefullyShutdown().then(() => {
            logger.info('Colyseus游戏服务器已关闭');
            process.exit(0);
        }).catch((err) => {
            logger.error('关闭Colyseus服务器时出错:', err);
            process.exit(1);
        });
    });
};

// 注册信号处理器
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// 未捕获异常处理
process.on('uncaughtException', (err) => {
    logger.error('未捕获的异常:', err);
    // 不立即退出，让服务器尝试继续运行
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', reason);
});

// 导出供测试使用
export { app, gameServer, server };
