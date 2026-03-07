"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
// =============================================================================
// Plugin Definition
// =============================================================================
exports.default = {
    id: 'hello-world',
    name: 'Hello World Plugin',
    description: 'A simple example plugin for Negentropy-Lab',
    version: '1.0.0',
    kind: 'core',
    main: 'index.ts',
    openclawCompat: true,
    negentropy: {
        agentIntegration: {
            model: 'google-antigravity/gemini-3-flash',
            timeout: 30000,
            depth: 5,
            permissions: ['read', 'write'],
        },
        entropyMonitor: {
            metrics: ['cpu', 'memory', 'disk'],
            thresholds: {
                cpu: 80,
                memory: 90,
                disk: 85,
            },
            alertLevel: 'warn',
        },
        constitutionalCompliance: {
            requiredClauses: ['§101', '§102', '§108', '§118', '§306'],
            validationRules: {
                type: 'object',
                rules: [
                    {
                        name: 'Model Specification',
                        description: 'Model must be explicitly specified',
                        type: 'required',
                    },
                    {
                        name: 'Timeout Configuration',
                        description: 'Timeout must be configured for L4 tasks',
                        type: 'required',
                    },
                ],
            },
        },
    },
    // ===========================================================================
    // Lifecycle Methods
    // ===========================================================================
    /**
     * 初始化插件
     */
    async initialize(api) {
        api.logger.info('🎉 Hello World plugin initialized!');
        api.logger.info('   This plugin demonstrates the plugin system capabilities.');
    },
    /**
     * 激活插件
     */
    async activate(api) {
        api.logger.info('🚀 Hello World plugin activated!');
        // 注册各种钩子
        this.registerHooks(api);
    },
    /**
     * 停用插件
     */
    async deactivate(api) {
        api.logger.info('🛑 Hello World plugin deactivated!');
    },
    /**
     * 清理插件
     */
    async cleanup(api) {
        api.logger.info('🧹 Hello World plugin cleaned up!');
    },
    // ===========================================================================
    // Hook Registration
    // ===========================================================================
    /**
     * 注册插件钩子
     */
    registerHooks(api) {
        // 系统启动钩子
        api.on('system_start', this.onSystemStart);
        // 系统停止钩子
        api.on('system_stop', this.onSystemStop);
        // 插件加载钩子
        api.on('plugin_loaded', this.onPluginLoaded);
        // Agent任务钩子
        api.on('before_agent_task', this.onBeforeAgentTask, { priority: 10 });
        api.on('after_agent_task', this.onAfterAgentTask, { priority: 10 });
        // 消息钩子
        api.on('message_received', this.onMessageReceived);
        api.on('message_sent', this.onMessageSent);
        // 配置变更钩子
        api.on('config_changed', this.onConfigChanged);
        // 错误钩子
        api.on('error_occurred', this.onErrorOccurred);
        api.logger.info('✅ All hooks registered successfully');
    },
    // ===========================================================================
    // Hook Handlers
    // ===========================================================================
    /**
     * 系统启动处理
     */
    onSystemStart: PluginHookHandlerMap['system_start'] = async (event, ctx) => {
        console.log('\n========================================');
        console.log('🎬 System Started');
        console.log('========================================\n');
    },
    /**
     * 系统停止处理
     */
    onSystemStop: PluginHookHandlerMap['system_stop'] = async (event, ctx) => {
        console.log('\n========================================');
        console.log('🛑 System Stopped');
        console.log('========================================\n');
    },
    /**
     * 插件加载处理
     */
    onPluginLoaded: PluginHookHandlerMap['plugin_loaded'] = async (event, ctx) => {
        console.log(`📦 Plugin loaded: ${event.pluginId}`);
    },
    /**
     * Agent任务执行前处理
     */
    onBeforeAgentTask: PluginHookHandlerMap['before_agent_task'] = async (event, ctx) => {
        console.log('\n🤖 Agent Task Starting');
        console.log('────────────────────────────────────────');
        console.log(`Task ID: ${event.taskId}`);
        console.log(`Task Description: ${event.taskDescription}`);
        console.log(`Complexity: ${ctx.complexity}`);
        console.log(`Model: ${ctx.model}`);
        console.log(`Timeout: ${ctx.timeout}ms`);
        console.log('');
    },
    /**
     * Agent任务执行后处理
     */
    onAfterAgentTask: PluginHookHandlerMap['after_agent_task'] = async (event, ctx) => {
        console.log('🤖 Agent Task Completed');
        console.log('────────────────────────────────────────');
        console.log(`Task ID: ${event.taskId}`);
        console.log(`Success: ${event.success}`);
        console.log(`Duration: ${event.durationMs}ms`);
        console.log('');
    },
    /**
     * 消息接收处理
     */
    onMessageReceived: PluginHookHandlerMap['message_received'] = async (event, ctx) => {
        console.log(`📩 Message received: ${event.content}`);
    },
    /**
     * 消息发送处理
     */
    onMessageSent: PluginHookHandlerMap['message_sent'] = async (event, ctx) => {
        console.log(`📤 Message sent: ${event.content}`);
    },
    /**
     * 配置变更处理
     */
    onConfigChanged: PluginHookHandlerMap['config_changed'] = async (event, ctx) => {
        console.log(`⚙️  Configuration changed: ${ctx.key}`);
        console.log(`   Old: ${JSON.stringify(ctx.oldValue)}`);
        console.log(`   New: ${JSON.stringify(ctx.newValue)}`);
    },
    /**
     * 错误处理
     */
    onErrorOccurred: PluginHookHandlerMap['error_occurred'] = async (event, ctx) => {
        console.error(`❌ Error occurred: ${ctx.errorMessage}`);
        console.error(`   Type: ${ctx.errorType}`);
        console.error(`   Source: ${ctx.source}`);
        if (ctx.stackTrace) {
            console.error(`   Stack:\n${ctx.stackTrace}`);
        }
    },
};
//# sourceMappingURL=index.js.map