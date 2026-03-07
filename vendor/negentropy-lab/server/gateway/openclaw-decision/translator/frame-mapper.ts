/**
 * 🚀 OpenClaw <-> Negentropy 帧映射器
 *
 * 实现 OpenClaw 协议 (req/res/payload) 与 Negentropy 协议 (request/response/result) 的双向映射。
 *
 * @constitution
 * §101 同步公理：帧映射规则需与协议合同同步
 * §102 熵减原则：集中维护协议映射逻辑
 * §152 单一真理源公理：此文件为帧映射唯一定义
 * §107 Legacy兼容层公理：保持与 OpenClaw 协议的兼容性
 *
 * @filename frame-mapper.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * OpenClaw 请求帧格式
 */
export interface OpenClawRequestFrame {
  /** 请求 ID */
  id: string | number;
  /** 方法名 */
  method: string;
  /** 参数 */
  params?: Record<string, unknown>;
}

/**
 * OpenClaw 响应帧格式（成功）
 */
export interface OpenClawSuccessFrame {
  /** 请求 ID */
  id: string | number;
  /** 成功载荷 */
  payload: unknown;
}

/**
 * OpenClaw 响应帧格式（错误）
 */
export interface OpenClawErrorFrame {
  /** 请求 ID */
  id: string | number;
  /** 错误码 */
  code: number;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  data?: unknown;
}

/**
 * OpenClaw 响应帧（联合类型）
 */
export type OpenClawResponseFrame = OpenClawSuccessFrame | OpenClawErrorFrame;

/**
 * Negentropy 请求格式
 */
export interface NegentropyRequest {
  /** 请求 ID */
  id: string | number;
  /** 方法名 */
  method: string;
  /** 参数 */
  params?: Record<string, unknown>;
}

/**
 * Negentropy 响应格式（成功）
 */
export interface NegentropySuccessResponse {
  /** 请求 ID */
  id: string | number;
  /** 结果 */
  result: unknown;
}

/**
 * Negentropy 响应格式（错误）
 */
export interface NegentropyErrorResponse {
  /** 请求 ID */
  id: string | number;
  /** 错误对象 */
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Negentropy 响应（联合类型）
 */
export type NegentropyResponse = NegentropySuccessResponse | NegentropyErrorResponse;

// ============================================================================
// OpenClaw -> Negentropy 映射
// ============================================================================

/**
 * 将 OpenClaw 请求帧转换为 Negentropy 请求格式
 */
export function mapOpenClawRequestToNegentropy(frame: OpenClawRequestFrame): NegentropyRequest {
  return {
    id: frame.id,
    method: frame.method,
    params: frame.params ?? {},
  };
}

/**
 * 将 Negentropy 响应转换为 OpenClaw 响应帧格式
 */
export function mapNegentropyResponseToOpenClaw(response: NegentropyResponse): OpenClawResponseFrame {
  if (isNegentropySuccessResponse(response)) {
    return {
      id: response.id,
      payload: response.result,
    };
  } else {
    return {
      id: response.id,
      code: response.error.code,
      message: response.error.message,
      data: response.error.data,
    };
  }
}

// ============================================================================
// Negentropy -> OpenClaw 映射
// ============================================================================

/**
 * 将 Negentropy 请求转换为 OpenClaw 请求帧格式
 */
export function mapNegentropyRequestToOpenClaw(request: NegentropyRequest): OpenClawRequestFrame {
  return {
    id: request.id,
    method: request.method,
    params: request.params ?? {},
  };
}

/**
 * 将 OpenClaw 响应帧转换为 Negentropy 响应格式
 */
export function mapOpenClawResponseToNegentropy(frame: OpenClawResponseFrame): NegentropyResponse {
  if (isOpenClawSuccessFrame(frame)) {
    return {
      id: frame.id,
      result: frame.payload,
    };
  } else {
    return {
      id: frame.id,
      error: {
        code: frame.code,
        message: frame.message,
        data: frame.data,
      },
    };
  }
}

// ============================================================================
// 类型守卫
// ============================================================================

/**
 * 检查是否为 OpenClaw 成功帧
 */
export function isOpenClawSuccessFrame(frame: OpenClawResponseFrame): frame is OpenClawSuccessFrame {
  return 'payload' in frame && !('code' in frame);
}

/**
 * 检查是否为 OpenClaw 错误帧
 */
export function isOpenClawErrorFrame(frame: OpenClawResponseFrame): frame is OpenClawErrorFrame {
  return 'code' in frame && 'message' in frame;
}

/**
 * 检查是否为 Negentropy 成功响应
 */
export function isNegentropySuccessResponse(
  response: NegentropyResponse
): response is NegentropySuccessResponse {
  return 'result' in response && !('error' in response);
}

/**
 * 检查是否为 Negentropy 错误响应
 */
export function isNegentropyErrorResponse(
  response: NegentropyResponse
): response is NegentropyErrorResponse {
  return 'error' in response;
}

// ============================================================================
// 帧类型判断
// ============================================================================

/**
 * OpenClaw 帧类型
 */
export type OpenClawFrameType = 'request' | 'response' | 'event' | 'unknown';

/**
 * 检测 OpenClaw 帧类型
 */
export function detectOpenClawFrameType(frame: Record<string, unknown>): OpenClawFrameType {
  if ('method' in frame && 'id' in frame) {
    return 'request';
  }
  if ('id' in frame && ('payload' in frame || 'code' in frame)) {
    return 'response';
  }
  if ('event' in frame || 'type' in frame) {
    return 'event';
  }
  return 'unknown';
}

// ============================================================================
// 错误码映射
// ============================================================================

/**
 * 标准错误码映射表
 * OpenClaw 错误码 -> Negentropy 错误码
 */
export const ERROR_CODE_MAP: Record<number, string> = {
  // JSON-RPC 标准错误码
  '-32700': 'PARSE_ERROR',
  '-32600': 'INVALID_REQUEST',
  '-32601': 'METHOD_NOT_FOUND',
  '-32602': 'INVALID_PARAMS',
  '-32603': 'INTERNAL_ERROR',

  // OpenClaw 自定义错误码
  '4000': 'AUTH_REQUIRED',
  '4001': 'AUTH_INVALID',
  '4002': 'AUTH_EXPIRED',
  '4003': 'AUTH_INSUFFICIENT_SCOPE',
  '5000': 'POLICY_DENY',
  '5001': 'POLICY_TIMEOUT',
  '5002': 'POLICY_RATE_LIMITED',
  '5003': 'METHOD_DISABLED',
  '5004': 'METHOD_RESTRICTED',
};

/**
 * 将 OpenClaw 错误码转换为 Negentropy 错误码
 */
export function mapOpenClawErrorCodeToNegentropy(code: number): string {
  return ERROR_CODE_MAP[code] ?? 'UNKNOWN_ERROR';
}

// ============================================================================
// 帧创建辅助函数
// ============================================================================

/**
 * 创建 OpenClaw 成功响应帧
 */
export function createOpenClawSuccessFrame(id: string | number, payload: unknown): OpenClawSuccessFrame {
  return { id, payload };
}

/**
 * 创建 OpenClaw 错误响应帧
 */
export function createOpenClawErrorFrame(
  id: string | number,
  code: number,
  message: string,
  data?: unknown
): OpenClawErrorFrame {
  return { id, code, message, data };
}

/**
 * 创建 Negentropy 成功响应
 */
export function createNegentropySuccessResponse(
  id: string | number,
  result: unknown
): NegentropySuccessResponse {
  return { id, result };
}

/**
 * 创建 Negentropy 错误响应
 */
export function createNegentropyErrorResponse(
  id: string | number,
  code: number,
  message: string,
  data?: unknown
): NegentropyErrorResponse {
  return { id, error: { code, message, data } };
}