/**
 * OpenClaw Gateway 协议契约（2026-02-27 基线）
 *
 * 单一真理源：openclaw-colyseus-api-mapping.md
 *
 * @constitution
 * §101 同步公理：RPC/事件契约变更需与映射规范同步
 * §102 熵减原则：集中维护方法清单，避免多源漂移
 * §152 单一真理源公理：契约清单作为网关协议判定基线
 */

export const OPENCLAW_RPC_METHODS = [
  // ControlRoom (21)
  'health',
  'status',
  'doctor.memory.status',
  'logs.tail',
  'usage.status',
  'usage.cost',
  'system-presence',
  'system-event',
  'wizard.start',
  'wizard.next',
  'wizard.cancel',
  'wizard.status',
  'exec.approvals.get',
  'exec.approvals.set',
  'exec.approvals.node.get',
  'exec.approvals.node.set',
  'exec.approval.request',
  'exec.approval.waitDecision',
  'exec.approval.resolve',
  'secrets.reload',
  'update.run',

  // AgentRoom (20)
  'agent',
  'agent.identity.get',
  'agent.wait',
  'agents.list',
  'agents.create',
  'agents.update',
  'agents.delete',
  'agents.files.list',
  'agents.files.get',
  'agents.files.set',
  'sessions.list',
  'sessions.preview',
  'sessions.patch',
  'sessions.reset',
  'sessions.delete',
  'sessions.compact',
  'chat.history',
  'chat.abort',
  'chat.send',
  'wake',

  // NodeRoom (18)
  'node.pair.request',
  'node.pair.list',
  'node.pair.approve',
  'node.pair.reject',
  'node.pair.verify',
  'node.rename',
  'node.list',
  'node.describe',
  'node.invoke',
  'node.invoke.result',
  'node.event',
  'node.canvas.capability.refresh',
  'device.pair.list',
  'device.pair.approve',
  'device.pair.reject',
  'device.pair.remove',
  'device.token.rotate',
  'device.token.revoke',

  // ChannelRoom (13)
  'channels.status',
  'channels.logout',
  'send',
  'tts.status',
  'tts.providers',
  'tts.enable',
  'tts.disable',
  'tts.convert',
  'tts.setProvider',
  'talk.config',
  'talk.mode',
  'voicewake.get',
  'voicewake.set',

  // CronRoom (9)
  'cron.list',
  'cron.status',
  'cron.add',
  'cron.update',
  'cron.remove',
  'cron.run',
  'cron.runs',
  'set-heartbeats',
  'last-heartbeat',

  // ConfigRoom (12)
  'config.get',
  'config.set',
  'config.apply',
  'config.patch',
  'config.schema',
  'models.list',
  'tools.catalog',
  'skills.status',
  'skills.bins',
  'skills.install',
  'skills.update',
  'browser.request',
] as const;

export const OPENCLAW_EVENTS = [
  'connect.challenge',
  'presence',
  'tick',
  'shutdown',
  'health',
  'heartbeat',
  'update.available',
  'exec.approval.requested',
  'exec.approval.resolved',
  'agent',
  'chat',
  'node.pair.requested',
  'node.pair.resolved',
  'node.invoke.request',
  'device.pair.requested',
  'device.pair.resolved',
  'talk.mode',
  'voicewake.changed',
  'cron',
] as const;

export type OpenClawRpcMethod = (typeof OPENCLAW_RPC_METHODS)[number];
export type OpenClawEvent = (typeof OPENCLAW_EVENTS)[number];

const RPC_SET = new Set<string>(OPENCLAW_RPC_METHODS);
const EVENT_SET = new Set<string>(OPENCLAW_EVENTS);

export function isOpenClawRpcMethod(method: string): method is OpenClawRpcMethod {
  return RPC_SET.has(method);
}

export function isOpenClawEvent(event: string): event is OpenClawEvent {
  return EVENT_SET.has(event);
}

export function getOpenClawContractSummary() {
  return {
    rpcCount: OPENCLAW_RPC_METHODS.length,
    eventCount: OPENCLAW_EVENTS.length,
  };
}

export const OPENCLAW_CONTRACT_VERSION = '2026-02-27';
