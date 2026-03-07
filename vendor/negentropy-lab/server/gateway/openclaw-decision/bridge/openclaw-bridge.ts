/**
 * 馃寜 OpenClaw 妗ユ帴鍣?
 *
 * @constitution
 * 搂101 鍚屾鍏悊锛氭ˉ鎺ュ櫒涓庡喅绛栨湇鍔″悓姝?
 * 搂102 鐔靛噺鍘熷垯锛氱粺涓€妗ユ帴鎺ュ彛
 * 搂109 ToolCallBridge锛氭爣鍑嗗寲妗ユ帴瑙勮寖
 *
 * @filename openclaw-bridge.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/bridge
 * @last_updated 2026-03-02
 */

import {
  DecisionRequest,
  DecisionResponse,
  generateTraceId,
} from '../contracts/decision-contract';
import { getDecisionController, DecisionController } from '../controller';

/**
 * 浼氳瘽淇℃伅
 */
export interface SessionInfo {
  connId: string;
  nonce: string;
  createdAt: number;
  lastActivity: number;
  authenticated: boolean;
}

/**
 * 妗ユ帴鍣ㄩ厤缃?
 */
export interface OpenClawBridgeConfig {
  /** 鏄惁鍚敤鍐崇瓥 */
  decisionEnabled?: boolean;
  /** 浼氳瘽瓒呮椂锛堟绉掞級 */
  sessionTimeout?: number;
  /** 鎸戞垬 nonce 闀垮害 */
  nonceLength?: number;
}

/**
 * 妗ユ帴浜嬩欢
 */
export interface BridgeEvent {
  event: string;
  payload: any;
}

/**
 * RPC 璇锋眰
 */
export interface RpcRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

/**
 * RPC 鍝嶅簲
 */
export interface RpcResponse {
  id: string;
  result?: any;
  error?: { code: number; message: string };
}

/**
 * OpenClaw 妗ユ帴鍣?
 * 澶勭悊 WebSocket 杩炴帴鐨勮璇佸拰鍐崇瓥
 */
export class OpenClawBridge {
  private config: Required<OpenClawBridgeConfig>;
  private sessions: Map<string, SessionInfo> = new Map();
  private controller: DecisionController;

  constructor(config: OpenClawBridgeConfig = {}) {
    this.config = {
      decisionEnabled: config.decisionEnabled ?? false,
      sessionTimeout: config.sessionTimeout ?? 300000, // 5 鍒嗛挓
      nonceLength: config.nonceLength ?? 32,
    };
    this.controller = getDecisionController();
  }

  /**
   * 澶勭悊鏂拌繛鎺?
   */
  handleConnection(connId: string): BridgeEvent {
    const nonce = this.generateNonce();
    const session: SessionInfo = {
      connId,
      nonce,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      authenticated: false,
    };
    this.sessions.set(connId, session);

    return {
      event: 'connect.challenge',
      payload: { nonce },
    };
  }

  /**
   * 澶勭悊 Hello 鍝嶅簲
   */
  handleHello(connId: string, payload: { nonce?: string }): BridgeEvent {
    const session = this.sessions.get(connId);
    if (!session) {
      return {
        event: 'hello-error',
        payload: { reason: 'Session not found' },
      };
    }

    if (payload.nonce !== session.nonce) {
      return {
        event: 'hello-error',
        payload: { reason: 'Invalid nonce' },
      };
    }

    session.authenticated = true;
    session.lastActivity = Date.now();

    return {
      event: 'hello-ok',
      payload: { authenticated: true },
    };
  }

  /**
   * 澶勭悊 RPC 璇锋眰
   */
  async handleRequest(connId: string, request: RpcRequest): Promise<RpcResponse> {
    const session = this.sessions.get(connId);
    if (!session) {
      return {
        id: request.id,
        error: { code: -32000, message: 'Session not found' },
      };
    }

    session.lastActivity = Date.now();

    // 濡傛灉鍚敤鍐崇瓥锛岃繘琛屽喅绛栨鏌?
    if (this.config.decisionEnabled) {
      const decisionRequest: DecisionRequest = {
        traceId: generateTraceId(),
        connId,
        transport: 'ws',
        method: request.method,
        params: request.params,
        ts: new Date().toISOString(),
      };

      const decision = await this.controller.handleDecision(decisionRequest);

      if (decision.action === 'REJECT') {
        return {
          id: request.id,
          error: { code: -32001, message: decision.reason || 'Request rejected by policy' },
        };
      }

      // 濡傛灉鏄?REWRITE锛屼娇鐢ㄦ敼鍐欏悗鐨勬柟娉曞拰鍙傛暟
      if (decision.action === 'REWRITE') {
        return {
          id: request.id,
          result: { _rewritten: true, method: decision.method, params: decision.params },
        };
      }
    }

    // 鏀捐璇锋眰
    return {
      id: request.id,
      result: { _passed: true },
    };
  }

  /**
   * 澶勭悊鏂紑杩炴帴
   */
  handleDisconnect(connId: string): void {
    this.sessions.delete(connId);
  }

  /**
   * 鑾峰彇浼氳瘽
   */
  getSession(connId: string): SessionInfo | undefined {
    return this.sessions.get(connId);
  }

  /**
   * 鑾峰彇鎵€鏈変細璇?
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 娓呯悊杩囨湡浼氳瘽
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [connId, session] of this.sessions) {
      if (now - session.lastActivity > this.config.sessionTimeout) {
        this.sessions.delete(connId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 鐢熸垚 nonce
   */
  private generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < this.config.nonceLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 璁剧疆鍐崇瓥鍚敤鐘舵€?
   */
  setDecisionEnabled(enabled: boolean): void {
    this.config.decisionEnabled = enabled;
  }

  /**
   * 鑾峰彇閰嶇疆
   */
  getConfig(): Required<OpenClawBridgeConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// 鍗曚緥绠＄悊
// ============================================================================

let bridgeInstance: OpenClawBridge | null = null;

/**
 * 鑾峰彇妗ユ帴鍣ㄥ崟渚?
 */
export function getOpenClawBridge(config?: OpenClawBridgeConfig): OpenClawBridge {
  if (!bridgeInstance || config) {
    bridgeInstance = new OpenClawBridge(config);
  }
  return bridgeInstance;
}

/**
 * 閲嶇疆妗ユ帴鍣?
 */
export function resetOpenClawBridge(): void {
  if (bridgeInstance) {
    bridgeInstance.getAllSessions().forEach(s => {
      bridgeInstance!.handleDisconnect(s.connId);
    });
  }
  bridgeInstance = null;
}

/**
 * 鍒涘缓妗ユ帴鍣?
 */
export function createOpenClawBridge(config?: OpenClawBridgeConfig): OpenClawBridge {
  return new OpenClawBridge(config);
}
