/**
 * @constitution
 * §101 同步公理：网关事件发布行为与协议契约同步
 * §102 熵减原则：统一事件封装降低事件语义分叉
 * §321-§324 实时通信公理：事件总线保障实时事件可追踪传播
 */
import { EventEmitter } from 'events';
import { isOpenClawEvent } from '../contracts/openclaw-contract';

export interface GatewayEventEnvelope {
  event: string;
  payload: any;
  timestamp: string;
  isContractEvent: boolean;
}

/**
 * 网关统一事件总线。
 *
 * 作用：
 * - 记录并发布所有网关事件
 * - 标记事件是否属于 OpenClaw 契约事件
 */
export class GatewayEventBus extends EventEmitter {
  emitEvent(event: string, payload: any): GatewayEventEnvelope {
    const envelope: GatewayEventEnvelope = {
      event,
      payload,
      timestamp: new Date().toISOString(),
      isContractEvent: isOpenClawEvent(event),
    };

    this.emit('event', envelope);
    this.emit(event, payload);
    return envelope;
  }
}

export default GatewayEventBus;
