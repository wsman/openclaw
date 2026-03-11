/**
 * @constitution
 * §101 同步公理: authority 事件存储实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority 事件存储逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename EventStore.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import { AuthorityEventRecord } from "./types";

export class EventStore {
  private readonly events: AuthorityEventRecord[] = [];
  private readonly subscribers = new Map<string, (event: AuthorityEventRecord) => void>();

  append(event: AuthorityEventRecord): AuthorityEventRecord {
    this.events.push(event);
    this.subscribers.forEach((subscriber) => subscriber(event));
    return event;
  }

  appendMany(events: AuthorityEventRecord[]): AuthorityEventRecord[] {
    events.forEach((event) => this.append(event));
    return events;
  }

  getAll(): AuthorityEventRecord[] {
    return [...this.events];
  }

  getRecent(limit = 50): AuthorityEventRecord[] {
    return this.events.slice(-limit);
  }

  count(): number {
    return this.events.length;
  }

  clear(): void {
    this.events.splice(0, this.events.length);
  }

  replace(events: AuthorityEventRecord[]): void {
    this.clear();
    events.forEach((event) => this.events.push(event));
  }

  subscribe(callback: (event: AuthorityEventRecord) => void): string {
    const subscriptionId = `event-sub:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    this.subscribers.set(subscriptionId, callback);
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    this.subscribers.delete(subscriptionId);
  }
}
