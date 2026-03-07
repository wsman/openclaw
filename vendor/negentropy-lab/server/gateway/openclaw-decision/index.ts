/**
 * 🚀 OpenClaw 决策模块索引
 *
 * 统一导出入口，提供完整的 OpenClaw 决策功能。
 *
 * @constitution
 * §101 同步公理：模块导出需与内部实现同步
 * §102 熵减原则：统一导出入口
 * §152 单一真理源公理：此文件为模块索引
 *
 * @filename index.ts
 * @version 1.1.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

// ============================================================================
// 决策合同
// ============================================================================

export {
  // 类型
  DecisionAction,
  DecisionRequest,
  DecisionResponse,
  DecisionMode,
  DecisionErrorCode,
  AuthMeta,
  PolicyTags,
  
  // 常量
  DECISION_ACTIONS,
  DECISION_MODES,
  DECISION_ERROR_CODES,
  DECISION_CONTRACT_VERSION,
  DECISION_CONTRACT_DATE,
  
  // 函数
  isValidDecisionAction,
  isValidDecisionMode,
  createDefaultDecisionRequest,
  createExecuteResponse,
  createRewriteResponse,
  createRejectResponse,
  generateTraceId,
} from './contracts/decision-contract';

// ============================================================================
// 帧映射器
// ============================================================================

export {
  // 类型
  OpenClawRequestFrame,
  OpenClawSuccessFrame,
  OpenClawErrorFrame,
  OpenClawResponseFrame,
  NegentropyRequest,
  NegentropySuccessResponse,
  NegentropyErrorResponse,
  NegentropyResponse,
  OpenClawFrameType,
  
  // 映射函数
  mapOpenClawRequestToNegentropy,
  mapNegentropyResponseToOpenClaw,
  mapNegentropyRequestToOpenClaw,
  mapOpenClawResponseToNegentropy,
  
  // 类型守卫
  isOpenClawSuccessFrame,
  isOpenClawErrorFrame,
  isNegentropySuccessResponse,
  isNegentropyErrorResponse,
  detectOpenClawFrameType,
  
  // 辅助函数
  mapOpenClawErrorCodeToNegentropy,
  createOpenClawSuccessFrame,
  createOpenClawErrorFrame,
  createNegentropySuccessResponse,
  createNegentropyErrorResponse,
  ERROR_CODE_MAP,
} from './translator/frame-mapper';

// ============================================================================
// 握手映射器
// ============================================================================

export {
  // 类型
  OpenClawConnectChallenge,
  OpenClawHelloOk,
  OpenClawHelloError,
  OpenClawHelloResponse,
  NegentropyChallenge,
  NegentropyHandshakeOk,
  NegentropyHandshakeError,
  NegentropyHandshakeResponse,
  HandshakeState,
  HandshakeEvent,
  
  // 映射函数
  mapOpenClawChallengeToNegentropy,
  mapNegentropyHandshakeToOpenClaw,
  mapNegentropyChallengeToOpenClaw,
  mapOpenClawHelloToNegentropy,
  
  // 类型守卫
  isOpenClawHelloOk,
  isOpenClawHelloError,
  isNegentropyHandshakeOk,
  isNegentropyHandshakeError,
  
  // 辅助函数
  generateNonce,
  isValidNonce,
  createOpenClawChallenge,
  createOpenClawHelloOk,
  createOpenClawHelloError,
  getNextHandshakeState,
} from './translator/handshake-mapper';

// ============================================================================
// 控制器
// ============================================================================

export {
  DecisionController,
  DecisionControllerConfig,
  getDecisionController,
  resetDecisionController,
  createDecisionController,
  DEFAULT_CONTROLLER_CONFIG,
} from './controller';

// ============================================================================
// 决策服务
// ============================================================================

export {
  DecisionService,
} from './service';

// ============================================================================
// 策略引擎
// ============================================================================

export {
  PolicyEngine,
  PolicyEngineConfig,
  PolicyResult,
} from './policy/policy-engine';

export {
  PolicyRule,
  PolicyRuleContext,
  PolicyRuleAction,
  DEFAULT_RULES,
  createRule,
} from './policy/policy-rules';

// ============================================================================
// 弹性组件
// ============================================================================

export {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerManager,
  CircuitState,
  CircuitStats,
  getCircuitBreakerManager,
  resetCircuitBreakerManager,
  createCircuitBreaker,
} from './resilience/circuit-breaker';

export {
  FallbackAdapter,
  FallbackAdapterConfig,
  FallbackAdapterConfig as FallbackConfig,
  FallbackStats,
  getFallbackAdapter,
  resetFallbackAdapter,
  createFallbackAdapter,
} from './resilience/fallback-adapter';

// ============================================================================
// 桥接器
// ============================================================================

export {
  OpenClawBridge,
  OpenClawBridgeConfig,
  getOpenClawBridge,
  resetOpenClawBridge,
  createOpenClawBridge,
} from './bridge/openclaw-bridge';

// ============================================================================
// 可观测性组件
// ============================================================================

export {
  // 类型
  AuditLogLevel,
  AuditEventType,
  AuditLogEntry,
  AuditLogConfig,
  AuditLogStats,
  
  // 常量
  DEFAULT_AUDIT_LOG_CONFIG,
  
  // 单例函数
  getAuditLogger,
  resetAuditLogger,
  createAuditLogger,
  
  // HTTP 处理器
  createAuditLogHandler,
  createAuditStatsHandler,
  createAuditTraceHandler,
} from './observability/audit-log';

export {
  // 类型
  OpenClawMetrics,
  
  // 单例函数
  getMetricsCollector,
  resetMetricsCollector,
  createMetricsHandler,
} from './observability/metrics';

export {
  // 类型
  TelemetryEvent,
  TelemetrySnapshot,
  
  // 单例函数
  getTelemetryBuffer,
  resetTelemetryBuffer,
  
  // 便捷记录函数
  recordDecisionEvent,
  recordCircuitBreakerEvent,
  recordFallbackEvent,
  recordLatencyEvent,
  recordSessionEvent,
  
  // HTTP 处理器
  createTelemetryHandler,
  createEventsHandler,
  createTelemetrySummaryHandler,
} from './observability/telemetry';

// ============================================================================
// 内部 API
// ============================================================================

export {
  createInternalApiRouter,
} from './api/internal-api';
