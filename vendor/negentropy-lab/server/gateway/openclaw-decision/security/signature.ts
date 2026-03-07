/**
 * 🔐 服务间签名验证
 *
 * @constitution
 * §101 同步公理：签名验证与配置同步
 * §102 熵减原则：集中签名逻辑
 * §107 通信安全公理：服务间通信安全
 *
 * @filename signature.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/security
 * @last_updated 2026-03-02
 */

import * as crypto from 'crypto';

/**
 * 签名配置
 */
export interface SignatureConfig {
  /** 签名密钥 */
  secretKey: string;
  /** 签名算法 */
  algorithm?: 'sha256' | 'sha512';
  /** 签名有效期（毫秒） */
  maxAge?: number;
  /** 是否启用签名 */
  enabled?: boolean;
}

/**
 * 签名头
 */
export interface SignatureHeaders {
  /** 签名值 */
  'x-signature': string;
  /** 签名时间戳 */
  'x-signature-timestamp': string;
  /** 签名 nonce */
  'x-signature-nonce'?: string;
}

/**
 * 签名验证结果
 */
export interface SignatureVerifyResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误原因 */
  reason?: string;
  /** 签名年龄（毫秒） */
  age?: number;
}

/**
 * 签名服务
 */
export class SignatureService {
  private config: Required<SignatureConfig>;

  constructor(config: SignatureConfig) {
    this.config = {
      algorithm: 'sha256',
      maxAge: 300000, // 5分钟
      enabled: true,
      ...config,
    };
  }

  /**
   * 生成签名
   */
  sign(payload: string, timestamp: number, nonce?: string): string {
    const message = this.buildMessage(payload, timestamp, nonce);
    return crypto
      .createHmac(this.config.algorithm, this.config.secretKey)
      .update(message)
      .digest('hex');
  }

  /**
   * 验证签名
   */
  verify(
    payload: string,
    signature: string,
    timestamp: number,
    nonce?: string
  ): SignatureVerifyResult {
    if (!this.config.enabled) {
      return { valid: true };
    }

    // 检查时间戳
    const now = Date.now();
    const age = now - timestamp;
    
    if (age > this.config.maxAge) {
      return {
        valid: false,
        reason: 'Signature expired',
        age,
      };
    }

    if (age < -this.config.maxAge) {
      return {
        valid: false,
        reason: 'Signature timestamp is in the future',
        age,
      };
    }

    // 计算预期签名
    const expectedSignature = this.sign(payload, timestamp, nonce);

    // 常量时间比较
    const valid = this.constantTimeCompare(signature, expectedSignature);

    return {
      valid,
      reason: valid ? undefined : 'Signature mismatch',
      age,
    };
  }

  /**
   * 从请求头提取签名信息
   */
  extractFromHeaders(headers: Record<string, string>): {
    signature?: string;
    timestamp?: number;
    nonce?: string;
  } {
    return {
      signature: headers['x-signature'],
      timestamp: headers['x-signature-timestamp']
        ? parseInt(headers['x-signature-timestamp'], 10)
        : undefined,
      nonce: headers['x-signature-nonce'],
    };
  }

  /**
   * 生成签名头
   */
  generateHeaders(payload: string): SignatureHeaders {
    const timestamp = Date.now();
    const nonce = this.generateNonce();
    const signature = this.sign(payload, timestamp, nonce);

    return {
      'x-signature': signature,
      'x-signature-timestamp': timestamp.toString(),
      'x-signature-nonce': nonce,
    };
  }

  /**
   * 构建签名消息
   */
  private buildMessage(payload: string, timestamp: number, nonce?: string): string {
    const parts = [timestamp.toString(), payload];
    if (nonce) {
      parts.push(nonce);
    }
    return parts.join('\n');
  }

  /**
   * 生成 nonce
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 常量时间比较
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SignatureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): Required<SignatureConfig> {
    return { ...this.config };
  }
}

/**
 * 创建签名服务
 */
export function createSignatureService(config: SignatureConfig): SignatureService {
  return new SignatureService(config);
}