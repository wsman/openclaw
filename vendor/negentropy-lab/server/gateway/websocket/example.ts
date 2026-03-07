/**
 * 🚀 WebSocket connection pool usage examples.
 *
 * This file is intentionally lightweight and compile-safe for test type checks.
 *
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §107 Gateway架构：网关模块标准化接口
 *
 * @filename example.ts
 * @version 7.5.0-dev
 * @category gateway/websocket
 * @last_updated 2026-03-03
 */

import { createConnectionPool } from './ConnectionPool';
import { performance } from 'perf_hooks';

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  timestamp: number;
}

interface OrderUpdate {
  orderId: string;
  status: 'pending' | 'filled' | 'cancelled';
  symbol: string;
  quantity: number;
  price: number;
  timestamp: number;
}

const WEBSOCKET_CONFIG = {
  maxConnections: 100,
  connectionTimeout: 10_000,
  heartbeatInterval: 30_000,
};

export class MarketDataSubscriber {
  private pool: any;
  private symbols: string[] = ['BTC_USD', 'ETH_USD', 'BNB_USD'];
  private stats = {
    messagesReceived: 0,
    errors: 0,
    avgLatency: 0,
    startTime: performance.now(),
  };

  constructor() {
    this.pool = createConnectionPool(WEBSOCKET_CONFIG as any);
  }

  private subscribeToSymbols(): void {
    if (typeof this.pool.send === 'function') {
      this.pool.send({
        type: 'subscribe',
        channels: ['market_data'],
        symbols: this.symbols,
      });
    }
  }

  public async start(): Promise<void> {
    if (typeof this.pool.connect === 'function') {
      await this.pool.connect();
    }
    this.subscribeToSymbols();
  }

  public async stop(): Promise<void> {
    if (typeof this.pool.disconnect === 'function') {
      await this.pool.disconnect();
    }
  }

  public handleMarketData(data: MarketData): void {
    const latency = Math.max(0, performance.now() - data.timestamp);
    this.stats.messagesReceived++;
    this.stats.avgLatency =
      (this.stats.avgLatency * (this.stats.messagesReceived - 1) + latency) /
      this.stats.messagesReceived;
  }

  public getStats() {
    return {
      ...this.stats,
      uptimeMs: Math.max(0, performance.now() - this.stats.startTime),
    };
  }
}

export class OrderUpdateSubscriber {
  private pool: any;
  private orders = new Map<string, OrderUpdate>();

  constructor() {
    this.pool = createConnectionPool(WEBSOCKET_CONFIG as any);
  }

  public async start(): Promise<void> {
    if (typeof this.pool.connect === 'function') {
      await this.pool.connect();
    }
  }

  public async stop(): Promise<void> {
    if (typeof this.pool.disconnect === 'function') {
      await this.pool.disconnect();
    }
  }

  public async sendOrder(symbol: string, quantity: number, price: number): Promise<string> {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    if (typeof this.pool.send === 'function') {
      this.pool.send({
        type: 'place_order',
        orderId,
        symbol,
        quantity,
        price,
        timestamp: performance.now(),
      });
    }
    this.orders.set(orderId, {
      orderId,
      status: 'pending',
      symbol,
      quantity,
      price,
      timestamp: Date.now(),
    });
    return orderId;
  }

  public async cancelOrder(orderId: string): Promise<void> {
    if (typeof this.pool.send === 'function') {
      this.pool.send({
        type: 'cancel_order',
        orderId,
        timestamp: performance.now(),
      });
    }
    const existing = this.orders.get(orderId);
    if (existing) {
      existing.status = 'cancelled';
      existing.timestamp = Date.now();
      this.orders.set(orderId, existing);
    }
  }
}

export class PerformanceTest {
  private pool: any;

  constructor() {
    this.pool = createConnectionPool({
      ...WEBSOCKET_CONFIG,
      maxConnections: 100,
    } as any);
  }

  public async runTest(
    durationMs: number = 30_000,
    messagesPerSecond: number = 50,
    _concurrentConnections: number = 5,
  ): Promise<void> {
    if (typeof this.pool.connect === 'function') {
      await this.pool.connect();
    }

    const startTime = performance.now();
    const endTime = startTime + durationMs;
    const intervalMs = Math.max(1, Math.floor(1000 / Math.max(1, messagesPerSecond)));

    while (performance.now() < endTime) {
      if (typeof this.pool.send === 'function') {
        this.pool.send({
          type: 'test_message',
          timestamp: performance.now(),
        });
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    await this.endTest(startTime, performance.now());
  }

  private async endTest(startTime: number, endTime: number): Promise<void> {
    const duration = endTime - startTime;
    void duration;
    if (typeof this.pool.disconnect === 'function') {
      await this.pool.disconnect();
    }
  }
}

async function main() {
  const marketSubscriber = new MarketDataSubscriber();
  await marketSubscriber.start();
  await marketSubscriber.stop();

  const orderSubscriber = new OrderUpdateSubscriber();
  await orderSubscriber.start();
  const orderId = await orderSubscriber.sendOrder('BTC_USD', 0.1, 45_000);
  await orderSubscriber.cancelOrder(orderId);
  await orderSubscriber.stop();

  const performanceTest = new PerformanceTest();
  await performanceTest.runTest();
}

if (require.main === module) {
  main().catch(console.error);
}

export default {
  MarketDataSubscriber,
  OrderUpdateSubscriber,
  PerformanceTest,
};
