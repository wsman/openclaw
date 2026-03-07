/**
 * OpenClaw RPC 别名映射。
 * 用于吸收历史命名漂移，统一到 canonical method。
 *
 * @constitution
 * §101 同步公理：协议别名与契约方法集同步维护
 * §102 熵减原则：统一历史漂移命名，降低协议分叉熵
 * §152 单一真理源公理：canonical method 作为唯一判定基线
 */

import { isOpenClawRpcMethod } from './openclaw-contract';

export const OPENCLAW_RPC_ALIAS_MAP: Record<string, string> = {
  // system.* 漂移
  'system.presence': 'system-presence',
  'system.event': 'system-event',

  // agents/sessions 漂移
  'agent.list': 'agents.list',
  'agent.create': 'agents.create',
  'agent.update': 'agents.update',
  'agent.delete': 'agents.delete',
  'agent.files.list': 'agents.files.list',
  'agent.files.get': 'agents.files.get',
  'agent.files.set': 'agents.files.set',

  'session.list': 'sessions.list',
  'session.preview': 'sessions.preview',
  'session.patch': 'sessions.patch',
  'session.reset': 'sessions.reset',
  'session.delete': 'sessions.delete',
  'session.compact': 'sessions.compact',

  // cron 漂移
  'add_cron_job': 'cron.add',
  'cron.add_job': 'cron.add',
  'cron.delete': 'cron.remove',
  'cron.execute': 'cron.run',

  // status 漂移
  'request_status': 'status',

  // config 漂移
  'config.update': 'config.patch',
  'config.validate': 'config.schema',

  // node/device 漂移
  'node.pairing.request': 'node.pair.request',
  'node.pairing.list': 'node.pair.list',
  'device.pairing.list': 'device.pair.list',
};

export function resolveOpenClawRpcAlias(method: string): string {
  return OPENCLAW_RPC_ALIAS_MAP[method] || method;
}

export function isOpenClawAlias(method: string): boolean {
  return Object.prototype.hasOwnProperty.call(OPENCLAW_RPC_ALIAS_MAP, method);
}

export function normalizeOpenClawRpcMethod(method: string): string {
  const canonical = resolveOpenClawRpcAlias(method);
  if (isOpenClawRpcMethod(canonical)) {
    return canonical;
  }
  return method;
}
