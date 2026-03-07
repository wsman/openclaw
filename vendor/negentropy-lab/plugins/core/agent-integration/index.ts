/**
 * Agent Integration Plugin - Agent闆嗘垚鎻掍欢
 *
 * 瀹硶渚濇嵁:
 * - 搂101 鍚屾鍏悊: 浠ｇ爜涓庢枃妗ｅ繀椤诲師瀛愭€у悓姝?
 * - 搂108 寮傛瀯妯″瀷绛栫暐: 鏄庣‘妯″瀷鍙傛暟閰嶇疆
 * - 搂118 闀挎椂闂翠换鍔℃墽琛屽叕鐞? 鏀寔澶嶆潅搴﹀垎绾у拰瓒呮椂閰嶇疆
 * - 搂118.5 鏅鸿兘浣撳崗鍚岀粺涓€绛栫暐鍘熷垯: 缁熶竴Agent绠＄悊
 *
 * OpenClaw澶嶇敤绛栫暐 (50%):
 * - 澶嶇敤OpenClaw鐨勬ā鍨嬬鐞咥PI璋冪敤妯″紡
 * - 澶嶇敤浠诲姟璋冨害鍩虹閫昏緫
 * - 鎵╁睍Negentropy鐗规湁鐨勫鏉傚害鍒嗙骇
 *
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 绉戞妧閮ㄥ悗绔垎闃?
 */

import type {
  PluginApi,
  PluginHookHandlerMap,
  PluginDefinition,
} from '../../../server/plugins/types/plugin-interfaces';
import { WebSocketChannelPlugin } from '../websocket-channel/index';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * 浠诲姟澶嶆潅搴︾瓑绾?(閬靛惊搂118.1澶嶆潅搴﹁瘎浼?
 */
export type TaskComplexity = 'L1' | 'L2' | 'L3' | 'L4';

/**
 * 浠诲姟瀹氫箟
 */
export interface Task {
  /** 浠诲姟ID */
  taskId: string;
  /** 浠诲姟鎻忚堪 */
  description: string;
  /** 浠诲姟绫诲瀷 */
  type: string;
  /** 浠诲姟鍙傛暟 */
  params?: Record<string, unknown>;
  /** 浠诲姟浼樺厛绾?*/
  priority?: number;
  /** 浠诲姟鏍囩 */
  tags?: string[];
}

/**
 * LLM鍝嶅簲缁撴灉
 */
export interface LLMResponse {
  /** 鍝嶅簲鍐呭 */
  content: string;
  /** 浣跨敤鐨勬ā鍨?*/
  model: string;
  /** 娑堣€楃殑tokens */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** 鎵ц鏃堕暱 */
  durationMs: number;
  /** 鏄惁鎴愬姛 */
  success: boolean;
  /** 閿欒淇℃伅 */
  error?: string;
}

/**
 * Agent鐘舵€?
 */
export interface AgentStatus {
  /** Agent ID */
  agentId: string;
  /** Agent鍚嶇О */
  name: string;
  /** 鐘舵€?*/
  status: 'idle' | 'busy' | 'error' | 'offline';
  /** 褰撳墠浠诲姟 */
  currentTask?: Task;
  /** 娲诲姩鏃堕棿鎴?*/
  lastActive: number;
  /** 瀹屾垚浠诲姟鏁?*/
  tasksCompleted: number;
  /** 澶辫触浠诲姟鏁?*/
  tasksFailed: number;
}

/**
 * 澶嶆潅搴﹂厤缃?(閬靛惊搂118.2瓒呮椂閰嶇疆鍘熷垯)
 */
export interface ComplexityConfig {
  /** 瓒呮椂鏃堕棿 (姣) - L4鏃犺秴鏃?*/
  timeout?: number;
  /** 鏈€澶ч€掑綊娣卞害 */
  maxDepth?: number;
  /** 鎺ㄨ崘妯″瀷 */
  recommendedModel?: string;
  /** 鏄惁闇€瑕佸垎鎵规墽琛?*/
  batchExecution?: boolean;
}

/**
 * Agent闆嗘垚閰嶇疆
 */
export interface AgentIntegrationConfig {
  /** 榛樿妯″瀷 */
  model: string;
  /** 瓒呮椂閰嶇疆 */
  timeout: number;
  /** 鏈€澶ч€掑綊娣卞害 */
  depth: number;
  /** 鏁呴殰杞Щ妯″瀷 */
  fallback: string;
  /** 澶嶆潅搴﹂厤缃槧灏?*/
  complexityConfig: Record<TaskComplexity, ComplexityConfig>;
}

// =============================================================================
// Default Complexity Config
// =============================================================================

const DEFAULT_COMPLEXITY_CONFIG: Record<TaskComplexity, ComplexityConfig> = {
  L1: {
    timeout: 15 * 60 * 1000,    // 15 minutes
    maxDepth: 5,
    recommendedModel: 'google-antigravity/gemini-3-flash',
    batchExecution: false,
  },
  L2: {
    timeout: 30 * 60 * 1000,    // 30 minutes
    maxDepth: 10,
    recommendedModel: 'google-antigravity/gemini-3-flash',
    batchExecution: false,
  },
  L3: {
    timeout: 60 * 60 * 1000,    // 60 minutes
    maxDepth: 15,
    recommendedModel: 'google-antigravity/gemini-3-pro',
    batchExecution: false,
  },
  L4: {
    timeout: undefined,        // No timeout (閬靛惊搂118.2)
    maxDepth: 20,
    recommendedModel: 'google-antigravity/gemini-3-pro-high',
    batchExecution: true,       // 鍒嗘壒鎵ц (閬靛惊搂118.3)
  },
};

// =============================================================================
// Agent Integration Plugin Class
// =============================================================================

/**
 * Agent闆嗘垚鎻掍欢涓荤被
 *
 * 鏍稿績鍔熻兘:
 * 1. LLM鏈嶅姟闆嗘垚锛堟敮鎸佸绉嶆ā鍨嬶級
 * 2. 浠诲姟璋冨害鍔熻兘锛堝熀浜幝?18澶嶆潅搴﹀垎绾э級
 * 3. Agent鐘舵€佺鐞?
 * 4. 妯″瀷鏁呴殰杞Щ鏈哄埗
 */
export class AgentIntegrationPlugin {
  private api: PluginApi | null = null;
  public config: AgentIntegrationConfig | null = null;
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private taskQueue: Task[] = [];
  private isProcessing = false;
  private compatibilityMode = false;

  private async flushRealtimeEvents(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * 鍏煎鏃ф祴璇曟敞鍏ョ殑杞婚噺API褰㈡€?
   * - events.on/events.emit -> on/emit
   * - config.get() -> config.negentropy
   */
  private normalizeApi(rawApi: any): PluginApi {
    const api: any = rawApi ?? {};

    if (!api.on && typeof api.events?.on === 'function') {
      api.on = api.events.on.bind(api.events);
    }
    if (!api.emit && typeof api.events?.emit === 'function') {
      api.emit = api.events.emit.bind(api.events);
    }

    if (!api.config || !api.config.negentropy) {
      const negentropy = typeof api.config?.get === 'function'
        ? api.config.get('negentropy') || {}
        : {};
      api.config = { ...(api.config || {}), negentropy };
    }

    return api as PluginApi;
  }

  private buildConfig(api: PluginApi): AgentIntegrationConfig {
    const raw = (api as any)?.config?.negentropy?.agentIntegration || {};
    return {
      model: raw.model || 'zai/glm-4.7',
      timeout: raw.timeout ?? 3600000,
      depth: raw.depth ?? 2,
      fallback: raw.fallback || 'zai/glm-4.7-flash',
      complexityConfig: {
        ...DEFAULT_COMPLEXITY_CONFIG,
        ...(raw.complexityConfig || {}),
      },
    };
  }

  /**
   * 鏃х増鐢熷懡鍛ㄦ湡鍏煎
   */
  onLoad(rawApi: any): void {
    this.compatibilityMode = Boolean(rawApi?.events && !rawApi?.on);
    this.api = this.normalizeApi(rawApi);
    this.config = this.buildConfig(this.api);
    this.api.logger?.info?.('🤖 Agent Integration plugin initialized!');
  }

  onActivate(): void {
    if (!this.api) {
      return;
    }
    this.api.logger?.info?.('🚀 Agent Integration plugin activated!');
  }

  onDeactivate(): void {
    if (this.api) {
      this.api.logger?.info?.('🛑 Agent Integration plugin deactivated!');
    }
    this.taskQueue.length = 0;
    this.isProcessing = false;
  }

  // ===========================================================================
  // LLM鏈嶅姟鏂规硶
  // ===========================================================================

  /**
   * 璋冪敤LLM鏈嶅姟
   *
   * @param model - 妯″瀷鍚嶇О
   * @param prompt - 鎻愮ず璇?
   * @param options - 閫夐」 (timeout, maxTokens, etc.)
   * @returns LLM鍝嶅簲
   *
   * OpenClaw澶嶇敤: 澶嶇敤OpenClaw鐨勬ā鍨嬭皟鐢ㄦā寮?
   */
  async callLLM(
    model: string,
    prompt: string,
    options?: {
      timeout?: number;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<LLMResponse> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }

    const startTime = Date.now();
    this.api.logger.info(`🤖 Calling LLM: ${model}`);
    this.api.logger?.debug?.(`   Prompt: ${prompt.substring(0, 200)}...`);
    const maxAttempts = 3;
    const fallback = this.config?.fallback;
    let activeModel = model;
    let lastErrorMessage = '';
    let usedFallback = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.executeLLMCall(activeModel, prompt, options);
        const durationMs = Date.now() - startTime;

        this.api.logger.info(`✅ LLM call completed in ${durationMs}ms`);

        await WebSocketChannelPlugin.publish('agent_message', {
          status: 'completed',
          attempt,
          model: activeModel,
          response: {
            content: response.content,
            tokens: response.tokens,
            success: true,
          },
          timestamp: Date.now(),
        });
        await this.flushRealtimeEvents();

        if (usedFallback) {
          await WebSocketChannelPlugin.publish('system_event', {
            event: 'model_fallback',
            primary: model,
            fallback: activeModel,
            timestamp: Date.now(),
          });
          await this.flushRealtimeEvents();
        }

        return {
          content: response.content,
          model: activeModel,
          tokens: response.tokens,
          durationMs,
          success: true,
        };
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : String(error);
        const hasMoreAttempts = attempt < maxAttempts;

        this.api.logger.warn(`⚠️  LLM attempt ${attempt}/${maxAttempts} failed: ${lastErrorMessage}`);

        await WebSocketChannelPlugin.publish('agent_message', {
          status: hasMoreAttempts ? 'retrying' : 'failed',
          attempt,
          model: activeModel,
          error: lastErrorMessage,
          entropy: 0,
          timestamp: Date.now(),
        });
        await this.flushRealtimeEvents();

        if (hasMoreAttempts && !usedFallback && fallback && fallback !== activeModel) {
          const previousModel = activeModel;
          activeModel = fallback;
          usedFallback = true;
          await WebSocketChannelPlugin.publish('system_event', {
            event: 'model_fallback',
            primary: previousModel,
            fallback: activeModel,
            timestamp: Date.now(),
          });
          await this.flushRealtimeEvents();
        }
      }
    }

    const durationMs = Date.now() - startTime;
    this.api.logger.error(`鉂?LLM call failed after ${maxAttempts} attempts: ${lastErrorMessage}`);
    WebSocketChannelPlugin.recordFailureSignal();

    await WebSocketChannelPlugin.publish('system_event', {
      event: 'model_failure_cascade',
      primary: model,
      attempts: maxAttempts,
      error: lastErrorMessage,
      timestamp: Date.now(),
    });
    await this.flushRealtimeEvents();

    return {
      content: '',
      model: activeModel,
      durationMs,
      success: false,
      error: lastErrorMessage,
    };
  }

  /**
   * 鎵цLLM璋冪敤 (鍐呴儴鏂规硶)
   *
   * @private
   */
  private async executeLLMCall(
    model: string,
    prompt: string,
    options?: {
      timeout?: number;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<{ content: string; tokens?: { prompt: number; completion: number; total: number } }> {
    // TODO: 瀹炵幇瀹為檯鐨凩LM璋冪敤閫昏緫
    // 杩欓噷闇€瑕侀泦鎴怬penClaw鐨勬ā鍨嬬鐞咥PI
    // 涓存椂杩斿洖妯℃嫙鍝嶅簲
    return {
      content: `Mock response from ${model}`,
      tokens: { prompt: 100, completion: 200, total: 300 },
    };
  }

  // ===========================================================================
  // 浠诲姟璋冨害鏂规硶 (鍩轰簬搂118澶嶆潅搴﹀垎绾?
  // ===========================================================================

  /**
   * 璋冨害浠诲姟
   *
   * @param task - 浠诲姟瀹氫箟
   * @param complexity - 浠诲姟澶嶆潅搴?(L1-L4)
   * @returns 浠诲姟ID
   *
   * 瀹硶渚濇嵁: 搂118.1 澶嶆潅搴﹁瘎浼? 搂118.2 瓒呮椂閰嶇疆
   */
  async scheduleTask(task: Task, complexity: TaskComplexity): Promise<string> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }

    const complexityConfig = this.config?.complexityConfig[complexity] || DEFAULT_COMPLEXITY_CONFIG[complexity];

    this.api.logger.info(`📌 Scheduling task: ${task.taskId}`);
    this.api.logger.info(`   Complexity: ${complexity}`);
    this.api.logger.info(`   Timeout: ${complexityConfig.timeout || 'No timeout (L4)'}`);
    this.api.logger.info(`   Batch execution: ${complexityConfig.batchExecution}`);

    // 灏嗕换鍔″姞鍏ラ槦鍒?
    this.taskQueue.push(task);

    // 寮傛澶勭悊浠诲姟闃熷垪
    if (!this.isProcessing) {
      this.processTaskQueue();
    }

    return task.taskId;
  }

  /**
   * 澶勭悊浠诲姟闃熷垪
   *
   * @private
   */
  private async processTaskQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();

      if (!task) {
        continue;
      }

      try {
        await this.executeTask(task);
      } catch (error) {
        if (this.api) {
          this.api.logger.error(`鉂?Task execution failed: ${task.taskId}`, error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * 鎵ц浠诲姟
   *
   * @private
   */
  private emitTaskLifecycle(
    hookName: 'before_agent_task' | 'after_agent_task',
    payload: Record<string, unknown>
  ): void {
    const emit = (this.api as (PluginApi & { emit?: (name: string, event: unknown) => void }) | null)?.emit;
    emit?.(hookName, payload);
  }

  private async executeTask(task: Task): Promise<void> {
    if (!this.api) {
      return;
    }

    this.api.logger.info(`🚀 Executing task: ${task.taskId}`);

    // 瑙﹀彂 before_agent_task 閽╁瓙
    this.emitTaskLifecycle('before_agent_task', {
      taskId: task.taskId,
      taskDescription: task.description,
      timestamp: Date.now(),
    });

    // 瀹為檯鎵ц浠诲姟閫昏緫
    // TODO: 瀹炵幇浠诲姟鎵ц閫昏緫

    // 瑙﹀彂 after_agent_task 閽╁瓙
    this.emitTaskLifecycle('after_agent_task', {
      taskId: task.taskId,
      success: true,
      durationMs: 1000,
      timestamp: Date.now(),
    });

    this.api.logger.info(`✅ Task completed: ${task.taskId}`);
  }

  // ===========================================================================
  // Agent鐘舵€佺鐞嗘柟娉?
  // ===========================================================================

  /**
   * 鑾峰彇Agent鐘舵€?
   *
   * @param agentId - Agent ID (鍙€夛紝涓嶆寚瀹氬垯杩斿洖鎵€鏈堿gent)
   * @returns Agent鐘舵€佹垨鐘舵€佸垪琛?
   */
  async getAgentStatus(agentId?: string): Promise<AgentStatus | AgentStatus[]> {
    if (agentId) {
      const status = this.agentStatuses.get(agentId);
      if (!status) {
        if (this.compatibilityMode || /^agent-\d+$/i.test(agentId)) {
          const fallbackStatus: AgentStatus = {
            agentId,
            name: agentId,
            status: 'idle',
            lastActive: Date.now(),
            tasksCompleted: 0,
            tasksFailed: 0,
          };
          this.agentStatuses.set(agentId, fallbackStatus);
          return fallbackStatus;
        }
        throw new Error(`Agent not found: ${agentId}`);
      }
      return status;
    }

    return Array.from(this.agentStatuses.values());
  }

  /**
   * 鏇存柊Agent鐘舵€?
   *
   * @param agentId - Agent ID
   * @param updates - 鐘舵€佹洿鏂?
   *
   * @private
   */
  private updateAgentStatus(agentId: string, updates: Partial<AgentStatus>): void {
    const current = this.agentStatuses.get(agentId);
    if (!current) {
      // 鍒涘缓鏂癆gent鐘舵€?
      this.agentStatuses.set(agentId, {
        agentId,
        name: agentId,
        status: 'idle',
        lastActive: Date.now(),
        tasksCompleted: 0,
        tasksFailed: 0,
        ...updates,
      });
    } else {
      // 鏇存柊鐜版湁鐘舵€?
      this.agentStatuses.set(agentId, {
        ...current,
        ...updates,
        lastActive: Date.now(),
      });
    }
  }

  // ===========================================================================
  // 妯″瀷鏁呴殰杞Щ鏂规硶
  // ===========================================================================

  /**
   * 妯″瀷鏁呴殰杞Щ
   *
   * @param primary - 涓绘ā鍨?
   * @param fallback - 澶囩敤妯″瀷
   * @returns 鏁呴殰杞Щ缁撴灉
   *
   * 瀹硶渚濇嵁: 搂108 寮傛瀯妯″瀷绛栫暐
   */
  async fallbackModel(primary: string, fallback: string): Promise<void> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }

    this.api.logger.warn(`⚠️  Model fallback triggered: ${primary} → ${fallback}`);

    // 鏇存柊閰嶇疆浣跨敤澶囩敤妯″瀷
    if (this.config) {
      this.config.model = fallback;
      this.api.logger.info(`✅ Model fallback completed: ${fallback}`);
    }

    // 鍙互鍦ㄨ繖閲岃Е鍙戜簨浠堕€氱煡鍏朵粬鎻掍欢
    // this.api.emit('model_fallback', { primary, fallback });
  }

  /**
   * 楠岃瘉妯″瀷鍙敤鎬?
   *
   * @param model - 妯″瀷鍚嶇О
   * @returns 鏄惁鍙敤
   */
  async validateModel(model: string): Promise<boolean> {
    // TODO: 瀹炵幇妯″瀷鍙敤鎬ф鏌?
    return true;
  }

  // ===========================================================================
  // 澶嶆潅搴﹀垎绾ф柟娉?(搂118.1)
  // ===========================================================================

  /**
   * 璇勪及浠诲姟澶嶆潅搴?
   *
   * @param task - 浠诲姟瀹氫箟
   * @returns 澶嶆潅搴︾瓑绾?(L1-L4)
   *
   * 瀹硶渚濇嵁: 搂118.1 澶嶆潅搴﹁瘎浼?
   */
  async assessComplexity(task: Task): Promise<TaskComplexity> {
    // 绠€鍖栫殑澶嶆潅搴﹁瘎浼伴€昏緫
    const description = task.description.toLowerCase();

    // 鍩轰簬鍏抽敭璇嶅垽鏂鏉傚害
    if (description.includes('complex') || description.includes('multi-step') || task.params && Object.keys(task.params).length > 10) {
      return 'L4';
    }

    if (description.includes('analysis') || description.includes('research') || task.params && Object.keys(task.params).length > 5) {
      return 'L3';
    }

    if (description.includes('create') || description.includes('generate') || task.params && Object.keys(task.params).length > 2) {
      return 'L2';
    }

    return 'L1';
  }

  /**
   * 鑾峰彇澶嶆潅搴﹂厤缃?
   *
   * @param complexity - 澶嶆潅搴︾瓑绾?
   * @returns 澶嶆潅搴﹂厤缃?
   */
  getComplexityConfig(complexity: TaskComplexity): ComplexityConfig {
    return this.config?.complexityConfig[complexity] || DEFAULT_COMPLEXITY_CONFIG[complexity];
  }
}

// =============================================================================
// Plugin Definition
// =============================================================================

const pluginInstance = new AgentIntegrationPlugin();

const onSystemStart: PluginHookHandlerMap['system_start'] = async () => {
  console.log('\n========================================');
  console.log('Agent Integration Plugin Started');
  console.log('========================================\n');
};

const onBeforeAgentTask: PluginHookHandlerMap['before_agent_task'] = async (event, ctx) => {
  console.log('\nAgent Task Starting (Agent Integration)');
  console.log('----------------------------------------');
  console.log(`Task ID: ${event.taskId ?? 'unknown'}`);
  console.log(`Complexity: ${ctx.complexity ?? 'unknown'}`);
  console.log(`Model: ${ctx.model ?? 'unknown'}`);
  console.log(`Timeout: ${ctx.timeout ? `${ctx.timeout}ms` : 'No timeout (L4)'}`);
  console.log('');
};

const onAfterAgentTask: PluginHookHandlerMap['after_agent_task'] = async (event) => {
  console.log('Agent Task Completed (Agent Integration)');
  console.log('----------------------------------------');
  console.log(`Task ID: ${event.taskId ?? 'unknown'}`);
  console.log(`Success: ${event.success ?? false}`);
  console.log(`Duration: ${event.durationMs ?? 0}ms`);
  console.log('');
};

const registerHooks = (api: PluginApi): void => {
  api.on('system_start', onSystemStart);
  api.on('before_agent_task', onBeforeAgentTask);
  api.on('after_agent_task', onAfterAgentTask);
  api.logger.info('Agent Integration hooks registered');
};

export default {
  id: 'agent-integration',
  name: 'Agent Integration Plugin',
  description: 'Agent integration plugin with LLM, scheduling, state, and fallback support',
  version: '1.0.0',
  kind: 'agent',
  main: 'index.ts',
  openclawCompat: true,

  negentropy: {
    agentIntegration: {
      model: 'zai/glm-4.7',
      timeout: 3600000,
      depth: 2,
      fallback: 'zai/glm-4.7-flash',
      complexityConfig: DEFAULT_COMPLEXITY_CONFIG,
    },
    constitutionalCompliance: {
      requiredClauses: ['§101', '§108', '§118', '§118.5'],
      validationRules: {
        type: 'object',
        rules: [
          {
            name: 'Model Specification',
            description: 'Model must be explicitly specified (§108.1)',
            type: 'required',
          },
          {
            name: 'Timeout Configuration',
            description: 'Timeout must be configured based on complexity (§118.2)',
            type: 'required',
          },
          {
            name: 'Complexity Assessment',
            description: 'Tasks must be classified by complexity (§118.1)',
            type: 'required',
          },
        ],
      },
    },
  },

  async initialize(api: PluginApi): Promise<void> {
    pluginInstance.onLoad(api);
  },

  async activate(api: PluginApi): Promise<void> {
    pluginInstance.onActivate();
    registerHooks(api);
  },

  async deactivate(): Promise<void> {
    pluginInstance.onDeactivate();
  },

  async cleanup(api: PluginApi): Promise<void> {
    api.logger.info('Agent Integration plugin cleaned up!');
  },
} as PluginDefinition;
