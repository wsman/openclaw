/**
 * 🚀 Gateway监控服务索引
 * 
 * 宪法依据:
 * - §504 监控系统公理: 系统必须实时监控宪法合规状态
 * - §505 监控数据持久化公理: 监控数据必须持久化存储
 * - §506 监控告警公理: 异常状态必须触发告警
 * 
 * 功能:
 * 1. 统一导出所有监控服务
 * 2. 提供服务工厂方法
 * 3. 集成配置管理
 * 
 * @version 1.0.0
 * @created 2026-03-01
 * @maintainer 科技部
 */

// 核心监控组件
export { CostTracker } from './core/CostTracker';
export { ConstitutionMonitor } from './core/ConstitutionMonitor';
export { EntropyService } from './core/EntropyService';

// Phase 5-1 UI深度集成
export { UIStateSyncService } from './ui-state-sync';
export { ControlPanelSyncService } from './control-panel-sync';
export { AgentExecutionVisualizer } from './agent-execution-visualizer';

// Phase 5-2 功能增强
export { StreamingOptimizer } from './streaming-optimizer';
export { TaskQueueVisualizer } from './task-queue-visualizer';
export { TaskSchedulerEnhanced } from './task-scheduler-enhanced';
export { PerformanceMetricsEnhanced } from './performance-metrics-enhanced';

// 类型导出
export type {
  StateChangeRecord,
  StateSubscription,
  StateSnapshot,
  StatePushEvent,
} from './ui-state-sync';

export type {
  ControlAction,
  ControlActionHandler,
  LinkageRule,
  ControlActionHistory,
} from './control-panel-sync';

export type {
  ExecutionState,
  ExecutionPhase,
  ExecutionStep,
  VisualizationEvent,
} from './agent-execution-visualizer';

export type {
  StreamChunk,
  StreamState,
  BatchResult,
} from './streaming-optimizer';

export type {
  Task,
  TaskStatus,
  TaskPriority,
  QueueState,
  QueueHealthReport,
} from './task-queue-visualizer';

export type {
  ScheduledTask,
  ScheduleStatus,
  TriggerType,
  RetryStrategy,
  ExecutionRecord,
} from './task-scheduler-enhanced';

export type {
  MetricType,
  MetricValue,
  HistogramData,
  ResponseTimeDistribution,
  ResourceUsage,
  ErrorRateHeatmap,
} from './performance-metrics-enhanced';

import { CostTracker } from './core/CostTracker';
import { ConstitutionMonitor } from './core/ConstitutionMonitor';
import { EntropyService } from './core/EntropyService';
import { UIStateSyncService } from './ui-state-sync';
import { ControlPanelSyncService } from './control-panel-sync';
import { AgentExecutionVisualizer } from './agent-execution-visualizer';
import { StreamingOptimizer } from './streaming-optimizer';
import { TaskQueueVisualizer } from './task-queue-visualizer';
import { TaskSchedulerEnhanced } from './task-scheduler-enhanced';
import { PerformanceMetricsEnhanced } from './performance-metrics-enhanced';

/**
 * 监控服务配置
 */
export interface MonitoringServicesConfig {
  enableUISync?: boolean;
  enableControlPanel?: boolean;
  enableExecutionVisualizer?: boolean;
  enableStreamingOptimizer?: boolean;
}

/**
 * 监控服务集合
 */
export interface MonitoringServices {
  costTracker: CostTracker;
  constitutionMonitor: ConstitutionMonitor;
  entropyService: EntropyService;
  uiStateSync?: UIStateSyncService;
  controlPanel?: ControlPanelSyncService;
  executionVisualizer?: AgentExecutionVisualizer;
  streamingOptimizer?: StreamingOptimizer;
}

/**
 * 创建监控服务集合
 */
export function createMonitoringServices(
  config: MonitoringServicesConfig = {}
): MonitoringServices {
  const costTracker = new CostTracker();
  const constitutionMonitor = new ConstitutionMonitor();
  const entropyService = new EntropyService();

  const services: MonitoringServices = {
    costTracker,
    constitutionMonitor,
    entropyService,
  };

  if (config.enableUISync !== false) {
    services.uiStateSync = new UIStateSyncService();
  }

  if (config.enableControlPanel !== false) {
    services.controlPanel = new ControlPanelSyncService();
  }

  if (config.enableExecutionVisualizer !== false) {
    services.executionVisualizer = new AgentExecutionVisualizer();
  }

  if (config.enableStreamingOptimizer !== false) {
    services.streamingOptimizer = new StreamingOptimizer();
  }

  return services;
}

/**
 * 清理监控服务
 */
export function disposeMonitoringServices(services: MonitoringServices): void {
  services.uiStateSync?.dispose();
  services.controlPanel?.dispose();
  services.executionVisualizer?.dispose();
  services.streamingOptimizer?.dispose();
}

export default {
  createMonitoringServices,
  disposeMonitoringServices,
  CostTracker,
  ConstitutionMonitor,
  EntropyService,
  UIStateSyncService,
  ControlPanelSyncService,
  AgentExecutionVisualizer,
  StreamingOptimizer,
};