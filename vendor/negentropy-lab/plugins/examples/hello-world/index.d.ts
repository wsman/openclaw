/**
 * Hello World Plugin - 示例插件
 *
 * 宪法依据:
 * - §101 同步公理: 代码与文档必须原子性同步
 * - §102 熵减原则: 复用已有架构，避免重复实现
 *
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 科技部后端分队
 */
declare const _default: {
    id: string;
    name: string;
    description: string;
    version: string;
    kind: string;
    main: string;
    openclawCompat: boolean;
    negentropy: {
        agentIntegration: {
            model: string;
            timeout: number;
            depth: number;
            permissions: string[];
        };
        entropyMonitor: {
            metrics: string[];
            thresholds: {
                cpu: number;
                memory: number;
                disk: number;
            };
            alertLevel: string;
        };
        constitutionalCompliance: {
            requiredClauses: string[];
            validationRules: {
                type: string;
                rules: {
                    name: string;
                    description: string;
                    type: string;
                }[];
            };
        };
    };
    /**
     * 初始化插件
     */
    initialize(api: PluginApi): Promise<void>;
    /**
     * 激活插件
     */
    activate(api: PluginApi): Promise<void>;
    /**
     * 停用插件
     */
    deactivate(api: PluginApi): Promise<void>;
    /**
     * 清理插件
     */
    cleanup(api: PluginApi): Promise<void>;
    /**
     * 注册插件钩子
     */
    registerHooks(api: PluginApi): void;
    /**
     * 系统启动处理
     */
    onSystemStart: (event: any, ctx: any) => Promise<void>;
    /**
     * 系统停止处理
     */
    onSystemStop: (event: any, ctx: any) => Promise<void>;
    /**
     * 插件加载处理
     */
    onPluginLoaded: (event: any, ctx: any) => Promise<void>;
    /**
     * Agent任务执行前处理
     */
    onBeforeAgentTask: (event: any, ctx: any) => Promise<void>;
    /**
     * Agent任务执行后处理
     */
    onAfterAgentTask: (event: any, ctx: any) => Promise<void>;
    /**
     * 消息接收处理
     */
    onMessageReceived: (event: any, ctx: any) => Promise<void>;
    /**
     * 消息发送处理
     */
    onMessageSent: (event: any, ctx: any) => Promise<void>;
    /**
     * 配置变更处理
     */
    onConfigChanged: (event: any, ctx: any) => Promise<void>;
    /**
     * 错误处理
     */
    onErrorOccurred: (event: any, ctx: any) => Promise<void>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map