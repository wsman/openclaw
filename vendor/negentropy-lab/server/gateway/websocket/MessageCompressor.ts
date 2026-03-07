/**
 * 🔧 WebSocket消息压缩管理器
 * 
 * 宪法依据：
 * - §107 通信安全公理：消息传输的安全和效率
 * - §111 资源管理公理：优化带宽和内存使用
 * - §306 零停机协议：无缝消息处理
 * 
 * 目标性能：
 * - 压缩率 > 60% (文本消息)
 * - 压缩延迟 < 5ms
 * - 批处理吞吐量 > 5000 msg/s
 */

import { createDeflate, createInflate, Deflate, Inflate } from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

/**
 * 压缩配置接口
 */
export interface CompressionConfig {
  enabled: boolean;
  threshold: number; // 压缩阈值(bytes)
  level: number; // 压缩级别(0-9)
  memLevel: number; // 内存级别(1-9)
  strategy: number; // 压缩策略
  batchSize: number; // 批处理大小
  batchTimeout: number; // 批处理超时(ms)
}

/**
 * 默认压缩配置
 */
const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  enabled: true,
  threshold: 1024, // 1KB以上消息压缩
  level: 6, // 平衡压缩率和速度
  memLevel: 8,
  strategy: 0, // Z_DEFAULT_STRATEGY
  batchSize: 100, // 批处理100条消息
  batchTimeout: 100, // 100ms批处理窗口
};

/**
 * 压缩结果接口
 */
export interface CompressionResult {
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  data: Buffer;
  ratio: number;
  processingTime: number;
}

/**
 * 批处理消息队列
 */
interface BatchQueue {
  messages: any[];
  timer: NodeJS.Timeout | null;
  promise: Promise<void> | null;
  resolve: (() => void) | null;
}

/**
 * 消息压缩器类
 */
export class MessageCompressor {
  private config: CompressionConfig;
  private batchQueues = new Map<string, BatchQueue>();
  private compressionStats = {
    totalMessages: 0,
    compressedMessages: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    averageCompressionRatio: 0,
    averageProcessingTime: 0,
  };

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
  }

  /**
   * 压缩单个消息
   */
  async compressMessage(message: any): Promise<CompressionResult> {
    const startTime = process.hrtime.bigint();
    
    try {
      // 序列化消息
      const originalData = JSON.stringify(message);
      const originalBuffer = Buffer.from(originalData, 'utf-8');
      const originalSize = originalBuffer.length;

      // 判断是否需要压缩
      if (!this.config.enabled || originalSize < this.config.threshold) {
        const endTime = process.hrtime.bigint();
        return {
          compressed: false,
          originalSize,
          compressedSize: originalSize,
          data: originalBuffer,
          ratio: 1.0,
          processingTime: Number(endTime - startTime) / 1_000_000,
        };
      }

      // 执行压缩
      const compressedBuffer = await this.compressBuffer(originalBuffer);
      const compressedSize = compressedBuffer.length;

      // 计算压缩率
      const ratio = compressedSize / originalSize;
      const endTime = process.hrtime.bigint();
      const processingTime = Number(endTime - startTime) / 1_000_000;

      // 更新统计
      this.updateCompressionStats(originalSize, compressedSize, processingTime);

      return {
        compressed: true,
        originalSize,
        compressedSize,
        data: compressedBuffer,
        ratio,
        processingTime,
      };
    } catch (error: any) {
      throw new Error(`Message compression failed: ${error.message}`);
    }
  }

  /**
   * 解压单个消息
   */
  async decompressMessage(compressedData: Buffer): Promise<any> {
    try {
      // 尝试解压
      const decompressedBuffer = await this.decompressBuffer(compressedData);
      
      // 反序列化
      const jsonString = decompressedBuffer.toString('utf-8');
      return JSON.parse(jsonString);
    } catch (error: any) {
      // 如果解压失败，可能是未压缩的消息
      try {
        const jsonString = compressedData.toString('utf-8');
        return JSON.parse(jsonString);
      } catch (parseError: any) {
        throw new Error(`Message decompression failed: ${parseError.message}`);
      }
    }
  }

  /**
   * 批量压缩消息
   */
  async compressBatch(messages: any[]): Promise<CompressionResult[]> {
    const compressionPromises = messages.map(msg => this.compressMessage(msg));
    return Promise.all(compressionPromises);
  }

  /**
   * 批量解压消息
   */
  async decompressBatch(compressedMessages: Buffer[]): Promise<any[]> {
    const decompressionPromises = compressedMessages.map(data => 
      this.decompressMessage(data)
    );
    return Promise.all(decompressionPromises);
  }

  /**
   * 添加到批处理队列
   */
  async addToBatchQueue(queueId: string, message: any): Promise<void> {
    let queue = this.batchQueues.get(queueId);
    
    if (!queue) {
      queue = {
        messages: [],
        timer: null,
        promise: null,
        resolve: null,
      };
      this.batchQueues.set(queueId, queue);
    }

    // 添加消息到队列
    queue.messages.push(message);

    // 如果队列未满，设置定时器
    if (queue.messages.length < this.config.batchSize && !queue.timer) {
      queue.promise = new Promise<void>((resolve) => {
        queue!.resolve = resolve;
        queue!.timer = setTimeout(() => {
          this.flushBatchQueue(queueId);
        }, this.config.batchTimeout);
      });
    }

    // 如果队列已满，立即刷新
    if (queue.messages.length >= this.config.batchSize) {
      await this.flushBatchQueue(queueId);
    }

    // 等待批处理完成
    if (queue.promise) {
      await queue.promise;
    }
  }

  /**
   * 刷新批处理队列
   */
  private async flushBatchQueue(queueId: string): Promise<void> {
    const queue = this.batchQueues.get(queueId);
    if (!queue || queue.messages.length === 0) {
      return;
    }

    // 清除定时器
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }

    // 批量压缩
    const messages = [...queue.messages];
    queue.messages = [];

    try {
      const compressionResults = await this.compressBatch(messages);
      
      // 这里可以添加发送逻辑，或者返回压缩结果
      console.log(`[MessageCompressor] 批处理完成: ${messages.length}条消息, 队列ID: ${queueId}`);
    } catch (error: any) {
      console.error(`[MessageCompressor] 批处理失败: ${error.message}`);
    }

    // 解决等待的Promise
    if (queue.resolve) {
      queue.resolve();
      queue.resolve = null;
    }
    queue.promise = null;
  }

  /**
   * Buffer压缩
   */
  private async compressBuffer(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const deflate = createDeflate({
        level: this.config.level,
        memLevel: this.config.memLevel,
        strategy: this.config.strategy,
      });

      deflate.on('data', (chunk) => chunks.push(chunk));
      deflate.on('end', () => resolve(Buffer.concat(chunks)));
      deflate.on('error', reject);

      deflate.end(buffer);
    });
  }

  /**
   * Buffer解压
   */
  private async decompressBuffer(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const inflate = createInflate();

      inflate.on('data', (chunk) => chunks.push(chunk));
      inflate.on('end', () => resolve(Buffer.concat(chunks)));
      inflate.on('error', reject);

      inflate.end(buffer);
    });
  }

  /**
   * 更新压缩统计
   */
  private updateCompressionStats(
    originalSize: number,
    compressedSize: number,
    processingTime: number
  ): void {
    this.compressionStats.totalMessages++;
    
    if (compressedSize < originalSize) {
      this.compressionStats.compressedMessages++;
      this.compressionStats.totalOriginalSize += originalSize;
      this.compressionStats.totalCompressedSize += compressedSize;
      
      // 计算平均压缩率
      this.compressionStats.averageCompressionRatio = 
        this.compressionStats.totalCompressedSize / 
        this.compressionStats.totalOriginalSize;
    }

    // 计算平均处理时间
    const totalTime = 
      this.compressionStats.averageProcessingTime * (this.compressionStats.totalMessages - 1) +
      processingTime;
    this.compressionStats.averageProcessingTime = totalTime / this.compressionStats.totalMessages;
  }

  /**
   * 获取压缩统计
   */
  getCompressionStats() {
    return {
      ...this.compressionStats,
      compressionRatioPercent: 
        ((1 - this.compressionStats.averageCompressionRatio) * 100).toFixed(2) + '%',
      config: this.config,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.compressionStats = {
      totalMessages: 0,
      compressedMessages: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageCompressionRatio: 0,
      averageProcessingTime: 0,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 清理所有批处理队列
   */
  cleanup(): void {
    this.batchQueues.forEach((queue, queueId) => {
      if (queue.timer) {
        clearTimeout(queue.timer);
      }
      if (queue.resolve) {
        queue.resolve();
      }
    });
    this.batchQueues.clear();
  }
}

export default MessageCompressor;
