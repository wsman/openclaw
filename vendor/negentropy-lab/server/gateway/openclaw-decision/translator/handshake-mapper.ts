/**
 * 🚀 OpenClaw <-> Negentropy 握手映射器
 *
 * 实现 OpenClaw 握手协议 (connect.challenge.payload.nonce) 与 
 * Negentropy 握手协议 (payload.challenge) 的双向映射。
 *
 * 关键约束：保持 OpenClaw nonce 语义不变，确保客户端兼容性。
 *
 * @constitution
 * §101 同步公理：握手映射规则需与协议合同同步
 * §102 熵减原则：集中维护握手映射逻辑
 * §152 单一真理源公理：此文件为握手映射唯一定义
 * §107 Legacy兼容层公理：保持与 OpenClaw 握手协议的完全兼容
 *
 * @filename handshake-mapper.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * OpenClaw 连接挑战帧
 * 协议格式: connect.challenge.payload.nonce
 */
export interface OpenClawConnectChallenge {
  /** 事件类型 */
  event: 'connect.challenge';
  /** 挑战载荷 */
  payload: {
    /** 随机数（用于握手验证） */
    nonce: string;
    /** 过期时间（可选） */
    expiresAt?: string;
    /** 服务器版本（可选） */
    serverVersion?: string;
    /** 协议版本 */
    protocolVersion?: string;
  };
}

/**
 * OpenClaw Hello 响应帧（成功）
 */
export interface OpenClawHelloOk {
  /** 事件类型 */
  event: 'hello-ok';
  /** 响应载荷 */
  payload: {
    /** 会话 ID */
    sessionId: string;
    /** 用户信息（可选） */
    user?: {
      id: string;
      name?: string;
      roles?: string[];
    };
    /** 服务器时间 */
    serverTime?: string;
  };
}

/**
 * OpenClaw Hello 响应帧（失败）
 */
export interface OpenClawHelloError {
  /** 事件类型 */
  event: 'hello-error';
  /** 错误载荷 */
  payload: {
    /** 错误码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 是否可重试 */
    retryable?: boolean;
  };
}

/**
 * OpenClaw Hello 响应（联合类型）
 */
export type OpenClawHelloResponse = OpenClawHelloOk | OpenClawHelloError;

/**
 * Negentropy 连接挑战格式
 */
export interface NegentropyChallenge {
  /** 挑战字符串 */
  challenge: string;
  /** 过期时间（可选） */
  expiresAt?: string;
  /** 服务器信息（可选） */
  serverInfo?: {
    version?: string;
    protocolVersion?: string;
  };
}

/**
 * Negentropy 握手响应（成功）
 */
export interface NegentropyHandshakeOk {
  /** 状态 */
  status: 'ok';
  /** 会话 ID */
  sessionId: string;
  /** 用户信息（可选） */
  user?: {
    id: string;
    name?: string;
    roles?: string[];
  };
  /** 服务器时间 */
  serverTime?: string;
}

/**
 * Negentropy 握手响应（失败）
 */
export interface NegentropyHandshakeError {
  /** 状态 */
  status: 'error';
  /** 错误码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 是否可重试 */
  retryable?: boolean;
}

/**
 * Negentropy 握手响应（联合类型）
 */
export type NegentropyHandshakeResponse = NegentropyHandshakeOk | NegentropyHandshakeError;

// ============================================================================
// OpenClaw -> Negentropy 映射
// ============================================================================

/**
 * 将 OpenClaw 连接挑战转换为 Negentropy 挑战格式
 *
 * 重要：保留 nonce 语义，不修改挑战值
 */
export function mapOpenClawChallengeToNegentropy(
  challenge: OpenClawConnectChallenge
): NegentropyChallenge {
  return {
    challenge: challenge.payload.nonce,
    expiresAt: challenge.payload.expiresAt,
    serverInfo: {
      version: challenge.payload.serverVersion,
      protocolVersion: challenge.payload.protocolVersion,
    },
  };
}

/**
 * 将 Negentropy 握手响应转换为 OpenClaw Hello 响应格式
 */
export function mapNegentropyHandshakeToOpenClaw(
  response: NegentropyHandshakeResponse
): OpenClawHelloResponse {
  if (isNegentropyHandshakeOk(response)) {
    return {
      event: 'hello-ok',
      payload: {
        sessionId: response.sessionId,
        user: response.user,
        serverTime: response.serverTime,
      },
    };
  } else {
    return {
      event: 'hello-error',
      payload: {
        code: response.code,
        message: response.message,
        retryable: response.retryable,
      },
    };
  }
}

// ============================================================================
// Negentropy -> OpenClaw 映射
// ============================================================================

/**
 * 将 Negentropy 挑战转换为 OpenClaw 连接挑战格式
 *
 * 重要：challenge 字段映射为 nonce，保持语义一致
 */
export function mapNegentropyChallengeToOpenClaw(
  challenge: NegentropyChallenge,
  protocolVersion: string = '3'
): OpenClawConnectChallenge {
  return {
    event: 'connect.challenge',
    payload: {
      nonce: challenge.challenge,
      expiresAt: challenge.expiresAt,
      serverVersion: challenge.serverInfo?.version,
      protocolVersion: challenge.serverInfo?.protocolVersion ?? protocolVersion,
    },
  };
}

/**
 * 将 OpenClaw Hello 响应转换为 Negentropy 握手响应格式
 */
export function mapOpenClawHelloToNegentropy(
  response: OpenClawHelloResponse
): NegentropyHandshakeResponse {
  if (isOpenClawHelloOk(response)) {
    return {
      status: 'ok',
      sessionId: response.payload.sessionId,
      user: response.payload.user,
      serverTime: response.payload.serverTime,
    };
  } else {
    return {
      status: 'error',
      code: response.payload.code,
      message: response.payload.message,
      retryable: response.payload.retryable,
    };
  }
}

// ============================================================================
// 类型守卫
// ============================================================================

/**
 * 检查是否为 OpenClaw Hello 成功响应
 */
export function isOpenClawHelloOk(response: OpenClawHelloResponse): response is OpenClawHelloOk {
  return response.event === 'hello-ok';
}

/**
 * 检查是否为 OpenClaw Hello 错误响应
 */
export function isOpenClawHelloError(response: OpenClawHelloResponse): response is OpenClawHelloError {
  return response.event === 'hello-error';
}

/**
 * 检查是否为 Negentropy 握手成功响应
 */
export function isNegentropyHandshakeOk(
  response: NegentropyHandshakeResponse
): response is NegentropyHandshakeOk {
  return response.status === 'ok';
}

/**
 * 检查是否为 Negentropy 握手错误响应
 */
export function isNegentropyHandshakeError(
  response: NegentropyHandshakeResponse
): response is NegentropyHandshakeError {
  return response.status === 'error';
}

// ============================================================================
// Nonce 生成与验证
// ============================================================================

/**
 * 生成安全的 nonce 字符串
 */
export function generateNonce(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  
  // 使用 crypto API 生成安全随机数
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    // 回退方案（Node.js 环境）
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
}

/**
 * 验证 nonce 格式
 */
export function isValidNonce(nonce: string): boolean {
  // nonce 应为非空字符串，长度 16-64，只包含字母数字
  if (!nonce || typeof nonce !== 'string') {
    return false;
  }
  if (nonce.length < 16 || nonce.length > 64) {
    return false;
  }
  return /^[A-Za-z0-9]+$/.test(nonce);
}

// ============================================================================
// 握手帧创建辅助函数
// ============================================================================

/**
 * 创建 OpenClaw 连接挑战帧
 */
export function createOpenClawChallenge(
  nonce?: string,
  options?: {
    expiresAt?: string;
    serverVersion?: string;
    protocolVersion?: string;
  }
): OpenClawConnectChallenge {
  return {
    event: 'connect.challenge',
    payload: {
      nonce: nonce ?? generateNonce(),
      expiresAt: options?.expiresAt,
      serverVersion: options?.serverVersion,
      protocolVersion: options?.protocolVersion ?? '3',
    },
  };
}

/**
 * 创建 OpenClaw Hello 成功响应
 */
export function createOpenClawHelloOk(
  sessionId: string,
  options?: {
    user?: { id: string; name?: string; roles?: string[] };
    serverTime?: string;
  }
): OpenClawHelloOk {
  return {
    event: 'hello-ok',
    payload: {
      sessionId,
      user: options?.user,
      serverTime: options?.serverTime ?? new Date().toISOString(),
    },
  };
}

/**
 * 创建 OpenClaw Hello 错误响应
 */
export function createOpenClawHelloError(
  code: string,
  message: string,
  retryable: boolean = false
): OpenClawHelloError {
  return {
    event: 'hello-error',
    payload: {
      code,
      message,
      retryable,
    },
  };
}

// ============================================================================
// 握手状态机
// ============================================================================

/**
 * 握手状态
 */
export type HandshakeState = 
  | 'idle'        // 初始状态
  | 'challenged'  // 已发送挑战
  | 'authenticating' // 正在认证
  | 'connected'   // 已连接
  | 'failed';     // 失败

/**
 * 握手状态转换事件
 */
export type HandshakeEvent = 
  | 'connect'     // 客户端连接
  | 'challenge'   // 发送挑战
  | 'hello'       // 收到 hello
  | 'success'     // 认证成功
  | 'error'       // 认证失败
  | 'disconnect'; // 断开连接

/**
 * 获取下一个握手状态
 */
export function getNextHandshakeState(
  currentState: HandshakeState,
  event: HandshakeEvent
): HandshakeState {
  const transitions: Record<HandshakeState, Record<HandshakeEvent, HandshakeState>> = {
    idle: {
      connect: 'challenged',
      challenge: 'idle',
      hello: 'idle',
      success: 'idle',
      error: 'idle',
      disconnect: 'idle',
    },
    challenged: {
      connect: 'challenged',
      challenge: 'challenged',
      hello: 'authenticating',
      success: 'connected',
      error: 'failed',
      disconnect: 'idle',
    },
    authenticating: {
      connect: 'authenticating',
      challenge: 'authenticating',
      hello: 'authenticating',
      success: 'connected',
      error: 'failed',
      disconnect: 'idle',
    },
    connected: {
      connect: 'connected',
      challenge: 'connected',
      hello: 'connected',
      success: 'connected',
      error: 'connected',
      disconnect: 'idle',
    },
    failed: {
      connect: 'idle',
      challenge: 'failed',
      hello: 'failed',
      success: 'failed',
      error: 'failed',
      disconnect: 'idle',
    },
  };

  return transitions[currentState][event];
}