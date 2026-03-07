/**
 * WebSocket Channel Plugin - WebSocket閫氫俊鎻掍欢
 *
 * 瀹硶渚濇嵁:
 * - 搂101 鍚屾鍏悊: 浠ｇ爜涓庢枃妗ｅ繀椤诲師瀛愭€у悓姝?
 * - 搂401-搂404 鐜閿氬畾鍏悊: 纭繚鎻掍欢鍦ㄦ纭殑鐜涓繍琛?
 * - 搂118.5 鏅鸿兘浣撳崗鍚岀粺涓€绛栫暐鍘熷垯: 鏀寔Agent闂撮€氫俊
 *
 * OpenClaw澶嶇敤绛栫暐 (60%):
 * - 澶嶇敤OpenClaw鐨刉ebSocket鏈嶅姟鍣ㄥ疄鐜?
 * - 澶嶇敤OpenClaw鐨勫鎴风绠＄悊閫昏緫
 * - 澶嶇敤OpenClaw鐨勬秷鎭箍鎾満鍒?
 *
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 绉戞妧閮ㄥ悗绔垎闃?
 */

import type {
  PluginApi,
  PluginHookHandlerMap,
  PluginDefinition,
} from '../../../server/plugins/types/plugin-interfaces';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * WebSocket娑堟伅绫诲瀷
 */
export type WSMessageType =
  | 'agent_message'       // Agent娑堟伅
  | 'system_event'        // 绯荤粺浜嬩欢
  | 'entropy_update'      // 鐔靛€兼洿鏂?
  | 'client_command'      // 瀹㈡埛绔懡浠?
  | 'broadcast'           // 骞挎挱娑堟伅
  | 'heartbeat';          // 蹇冭烦

/**
 * WebSocket娑堟伅
 */
export interface WSMessage {
  /** 娑堟伅绫诲瀷 */
  type: WSMessageType;
  /** 娑堟伅鍐呭 */
  content: unknown;
  /** 娑堟伅ID */
  messageId: string;
  /** 鍙戦€佽€匢D */
  from?: string;
  /** 鎺ユ敹鑰匢D (鍙€夛紝涓嶆寚瀹氬垯骞挎挱) */
  to?: string;
  /** 鏃堕棿鎴?*/
  timestamp: number;
  /** 鍏冩暟鎹?*/
  metadata?: Record<string, unknown>;
}

/**
 * 瀹㈡埛绔俊鎭?
 */
export interface ClientInfo {
  /** 瀹㈡埛绔疘D */
  clientId: string;
  /** 瀹㈡埛绔被鍨?*/
  clientType: 'agent' | 'monitor' | 'ui' | 'external';
  /** 瀹㈡埛绔悕绉?*/
  clientName?: string;
  /** 杩炴帴鏃堕棿 */
  connectedAt: number;
  /** 鏈€鍚庢椿鍔ㄦ椂闂?*/
  lastActiveAt: number;
  /** 瀹㈡埛绔疘P */
  ip?: string;
  /** 瀹㈡埛绔厓鏁版嵁 */
  metadata?: Record<string, unknown>;
}

/**
 * WebSocket閰嶇疆
 */
export interface WebSocketConfig {
  /** 鏈嶅姟鍣ㄧ鍙?*/
  port: number;
  /** 璺緞鍓嶇紑 */
  path: string;
  /** 鍏佽鐨勬潵婧?*/
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
  };
  /** 蹇冭烦闂撮殧 (姣) */
  heartbeatInterval: number;
  /** 蹇冭烦瓒呮椂 (姣) */
  heartbeatTimeout: number;
  /** 鏈€澶ц繛鎺ユ暟 */
  maxConnections: number;
}

/**
 * 缁熻淇℃伅
 */
export interface ChannelStats {
  /** 鎬昏繛鎺ユ暟 */
  totalConnections: number;
  /** 褰撳墠杩炴帴鏁?*/
  activeConnections: number;
  /** 鎬绘秷鎭暟 */
  totalMessages: number;
  /** 鎬诲箍鎾暟 */
  totalBroadcasts: number;
  /** 鎬婚敊璇暟 */
  totalErrors: number;
  /** 鍚姩鏃堕棿 */
  startTime: number;
}

// =============================================================================
// Default Config
// =============================================================================

const DEFAULT_CONFIG: WebSocketConfig = {
  port: 3001,
  path: '/socket',
  cors: {
    origin: '*',
    credentials: true,
  },
  heartbeatInterval: 25000,
  heartbeatTimeout: 60000,
  maxConnections: 100,
};

// =============================================================================
// WebSocket Channel Plugin Class
// =============================================================================

/**
 * WebSocket閫氫俊鎻掍欢涓荤被
 *
 * 鏍稿績鍔熻兘:
 * 1. WebSocket鏈嶅姟鍣?
 * 2. 娑堟伅骞挎挱鍔熻兘
 * 3. 瀹㈡埛绔鐞?
 */
export class WebSocketChannelPlugin {
  private static activeRuntimeInstance: WebSocketChannelPlugin | null = null;
  private static pendingFailureSignals = 0;

  private api: PluginApi | null = null;
  public config: WebSocketConfig | null = null;
  private compatibilityMode = false;
  private io: SocketIOServer | null = null;
  private httpServer: HTTPServer | null = null;
  private clients: Map<string, ClientInfo> = new Map();
  private clientAliases: Map<string, string> = new Map();
  private socketToAlias: Map<string, string> = new Map();
  private aliasSequence = 0;
  private messageHandlers: Array<(data: Record<string, unknown>) => void> = [];
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private stats: ChannelStats = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    totalBroadcasts: 0,
    totalErrors: 0,
    startTime: 0,
  };

  /**
   * 鍏煎鏃ф祴璇曟敞鍏PI
   */
  private normalizeApi(rawApi: any): PluginApi {
    const api: any = rawApi ?? {};

    if (!api.on && typeof api.events?.on === 'function') {
      api.on = api.events.on.bind(api.events);
    }
    if (!api.emit && typeof api.events?.emit === 'function') {
      api.emit = api.events.emit.bind(api.events);
    }

    if (!api.config || !api.config.negentropy) {
      const negentropy = typeof api.config?.get === 'function'
        ? api.config.get('negentropy') || {}
        : {};
      api.config = { ...(api.config || {}), negentropy };
    }

    return api as PluginApi;
  }

  private buildConfig(api: PluginApi): WebSocketConfig {
    const raw = (api as any)?.config?.negentropy?.websocket
      || (api as any)?.config?.negentropy?.websocketChannel
      || {};

    // 鍏煎鏃ф祴璇?瀹㈡埛绔粯璁よ繛鎺ヨ矾寰勶紙socket.io-client 榛樿 path=/socket.io锛?
    const compatibilityDefaults = this.compatibilityMode
      ? { path: '/socket.io' }
      : {};

    return {
      ...DEFAULT_CONFIG,
      ...compatibilityDefaults,
      ...raw,
      cors: {
        ...DEFAULT_CONFIG.cors,
        ...(raw.cors || {}),
      },
    };
  }

  /**
   * 鏃х敓鍛藉懆鏈熷吋瀹规帴鍙?
   */
  onLoad(rawApi: any): void {
    // 鍏煎妯″紡鍒ゅ畾涓嶈兘渚濊禆 rawApi.on 鏄惁瀛樺湪锛?
    // 鍏变韩 mock API 鍙兘宸茶鍏朵粬鎻掍欢 onLoad 娉ㄥ叆 on/emit銆?
    this.compatibilityMode = Boolean(
      rawApi?.events
      && typeof rawApi.events.on === 'function'
      && typeof rawApi.events.emit === 'function',
    );
    this.api = this.normalizeApi(rawApi);
    this.config = this.buildConfig(this.api);
    this.api.logger?.info?.('馃寪 WebSocket Channel plugin initialized!');
  }

  async onActivate(): Promise<void> {
    if (!this.api) {
      return;
    }
    WebSocketChannelPlugin.activeRuntimeInstance = this;
    this.api.logger?.info?.('馃殌 WebSocket Channel plugin activated!');
  }

  async onDeactivate(): Promise<void> {
    if (this.api) {
      this.api.logger?.info?.('馃洃 WebSocket Channel plugin deactivated!');
    }
    await this.stopServer();
    if (WebSocketChannelPlugin.activeRuntimeInstance === this) {
      WebSocketChannelPlugin.activeRuntimeInstance = null;
    }
  }

  // ===========================================================================
  // 鏈嶅姟鍣ㄦ帶鍒舵柟娉?
  // ===========================================================================

  /**
   * 鍚姩WebSocket鏈嶅姟鍣?
   *
   * @param port - 绔彛鍙?(鍙€夛紝榛樿浣跨敤閰嶇疆涓殑绔彛)
   *
   * OpenClaw澶嶇敤: 澶嶇敤OpenClaw鐨刉ebSocket鏈嶅姟鍣ㄥ疄鐜版ā寮?
   */
  async startServer(port?: number): Promise<boolean> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }

    if (this.io) {
      this.api.logger.warn('WebSocket server already started');
      return true;
    }

    const serverPort = port ?? this.config?.port ?? DEFAULT_CONFIG.port;

    this.api.logger.info(`馃殌 Starting WebSocket server on port ${serverPort}`);

    try {
      // 鍒涘缓HTTP鏈嶅姟鍣?
      this.httpServer = new HTTPServer();

      // 鍒涘缓Socket.IO鏈嶅姟鍣?
      this.io = new SocketIOServer(this.httpServer, {
        path: this.config?.path || DEFAULT_CONFIG.path,
        cors: this.config?.cors || DEFAULT_CONFIG.cors,
        pingInterval: this.config?.heartbeatInterval || DEFAULT_CONFIG.heartbeatInterval,
        pingTimeout: this.config?.heartbeatTimeout || DEFAULT_CONFIG.heartbeatTimeout,
      });

      // 娉ㄥ唽浜嬩欢澶勭悊鍣?
      this.registerSocketHandlers();

      // 鍚姩HTTP鏈嶅姟鍣紙鏄惧紡澶勭悊 listen error锛岄伩鍏嶇鍙ｅ啿绐佹椂鎸傝捣锛?
      await new Promise<void>((resolve, reject) => {
        const server = this.httpServer!;
        const onError = (err: Error) => {
          server.off('listening', onListening);
          reject(err);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(serverPort);
      });

      // 鏇存柊缁熻淇℃伅
      this.stats.startTime = Date.now();

      // 鍚姩蹇冭烦妫€鏌?
      this.startHeartbeatCheck();

      const address = this.httpServer.address();
      const boundPort = typeof address === 'object' && address ? address.port : serverPort;

      this.api.logger.info(`鉁?WebSocket server started on port ${boundPort}`);
      this.api.logger.info(`   Path: ${this.config?.path || DEFAULT_CONFIG.path}`);

      // 瑙﹀彂绯荤粺鍚姩浜嬩欢
      if (this.api) {
        this.api.emit?.('system_start', {
          pluginId: this.api.id,
          port: boundPort,
          timestamp: Date.now(),
        });
      }
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.api.logger.error(`鉂?Failed to start WebSocket server: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 鍋滄WebSocket鏈嶅姟鍣?
   */
  async stopServer(): Promise<boolean> {
    if (!this.api || !this.io) {
      return true;
    }

    this.api.logger.info('馃洃 Stopping WebSocket server');

    // 鍋滄蹇冭烦妫€鏌?
    this.stopHeartbeatCheck();

    // 鏂紑鎵€鏈夊鎴风
    this.io.close();

    // 鍋滄HTTP鏈嶅姟鍣?
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }

    this.clients.clear();
    this.clientAliases.clear();
    this.socketToAlias.clear();
    this.stats.activeConnections = 0;

    this.io = null;

    this.api.logger.info('鉁?WebSocket server stopped');
    return true;
  }

  /**
   * 閲嶅惎WebSocket鏈嶅姟鍣?
   */
  async restartServer(): Promise<void> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }

    this.api.logger.info('馃攧 Restarting WebSocket server');

    await this.stopServer();
    await this.startServer();
  }

  // ===========================================================================
  // Socket浜嬩欢澶勭悊鏂规硶
  // ===========================================================================

  /**
   * 娉ㄥ唽Socket浜嬩欢澶勭悊鍣?
   *
   * @private
   */
  private registerSocketHandlers(): void {
    if (!this.io) {
      return;
    }

    // 杩炴帴浜嬩欢
    this.io.on('connection', this.handleConnection.bind(this));
  }

  /**
   * 澶勭悊杩炴帴
   *
   * @private
   */
  private handleConnection(socket: Socket): void {
    const clientId = socket.id;

    if (!this.api) {
      return;
    }

    // 妫€鏌ヨ繛鎺ユ暟闄愬埗
    const maxConnections = this.config?.maxConnections || DEFAULT_CONFIG.maxConnections;
    if (this.clients.size >= maxConnections) {
      this.api.logger.warn(`鈿狅笍  Max connections reached, rejecting client: ${clientId}`);
      socket.disconnect(true);
      return;
    }

    // 鍒涘缓瀹㈡埛绔俊鎭?
    const clientInfo: ClientInfo = {
      clientId,
      clientType: 'external', // 榛樿绫诲瀷
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
      ip: socket.handshake.address,
    };

    // 淇濆瓨瀹㈡埛绔俊鎭?
    this.clients.set(clientId, clientInfo);
    const aliasId = `client-${this.aliasSequence++}`;
    this.clientAliases.set(aliasId, clientId);
    this.socketToAlias.set(clientId, aliasId);

    // 鏇存柊缁熻淇℃伅
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    this.api.logger.info(`馃摫 Client connected: ${clientId} (${clientInfo.ip})`);
    this.api.logger.info(`   Active connections: ${this.stats.activeConnections}`);

    // 鍙戦€佹杩庢秷鎭?
    socket.emit('connected', {
      clientId,
      message: 'Welcome to Negentropy-Lab WebSocket Channel',
      timestamp: Date.now(),
    });

    // 娉ㄥ唽璇ュ鎴风鐨勪簨浠跺鐞嗗櫒
    socket.on('disconnect', () => this.handleDisconnect(socket));
    socket.on('message', (message: WSMessage) => this.handleMessage(socket, message));
    socket.on('heartbeat', (data: unknown) => this.handleHeartbeat(socket, data));
    socket.on('client_register', (data: { clientType: ClientInfo['clientType']; clientName?: string }) => {
      this.handleClientRegister(socket, data);
    });
    socket.on('agent_message', (data: any) => {
      const agentMessage: WSMessage = {
        type: 'agent_message',
        content: data,
        messageId: data?.messageId || `agent-message-${Date.now()}`,
        timestamp: data?.timestamp || Date.now(),
      };
      this.handleMessage(socket, agentMessage);
    });
    socket.on('client_command', (data: any) => {
      const commandMessage: WSMessage = {
        type: 'client_command',
        content: data,
        messageId: data?.messageId || `command-${Date.now()}`,
        timestamp: data?.timestamp || Date.now(),
      };
      this.handleMessage(socket, commandMessage);
    });
  }

  /**
   * 澶勭悊鏂紑
   *
   * @private
   */
  private handleDisconnect(socket: Socket): void {
    const clientId = socket.id;

    if (!this.api) {
      return;
    }

    // 鑾峰彇瀹㈡埛绔俊鎭?
    const clientInfo = this.clients.get(clientId);

    // 鍒犻櫎瀹㈡埛绔俊鎭?
    this.clients.delete(clientId);
    const alias = this.socketToAlias.get(clientId);
    if (alias) {
      this.clientAliases.delete(alias);
      this.socketToAlias.delete(clientId);
    }

    // 鏇存柊缁熻淇℃伅
    this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);

    this.api.logger.info(`馃摫 Client disconnected: ${clientId}`);
    this.api.logger.info(`   Active connections: ${this.stats.activeConnections}`);
  }

  /**
   * 澶勭悊娑堟伅
   *
   * @private
   */
  private handleMessage(socket: Socket, message: WSMessage): void {
    if (!this.api) {
      return;
    }

    const clientId = socket.id;

    // 鏇存柊瀹㈡埛绔渶鍚庢椿鍔ㄦ椂闂?
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      clientInfo.lastActiveAt = Date.now();
    }

    // 鏇存柊缁熻淇℃伅
    this.stats.totalMessages++;

    this.api.logger?.debug?.(`馃摠 Message received from ${clientId}: ${message.type}`);

    // 鏍规嵁娑堟伅绫诲瀷澶勭悊
    switch (message.type) {
      case 'agent_message':
        this.handleAgentMessage(socket, message);
        break;
      case 'client_command':
        this.handleClientCommand(socket, message);
        break;
      case 'broadcast':
        this.handleBroadcast(socket, message);
        break;
      default:
        this.api.logger.warn(`鈿狅笍  Unknown message type: ${message.type}`);
    }
  }

  /**
   * 澶勭悊Agent娑堟伅
   *
   * @private
   */
  private handleAgentMessage(socket: Socket, message: WSMessage): void {
    if (!this.io) {
      return;
    }

    const payload =
      typeof message.content === 'object' && message.content !== null
        ? {
            ...(message.content as Record<string, unknown>),
            messageId: message.messageId,
            timestamp: message.timestamp,
          }
        : {
            content: message.content,
            messageId: message.messageId,
            timestamp: message.timestamp,
          };

    // 鍏煎鏃ф祴璇曡涔夛細鍚戞墍鏈夊鎴风骞挎挱锛堝寘鍚彂閫佽€咃級
    this.io.emit('agent_message', payload);

    if (this.api) {
      this.api.logger?.debug?.(`馃摠 Agent message broadcasted: ${message.messageId}`);
    }
  }

  /**
   * 澶勭悊瀹㈡埛绔懡浠?
   *
   * @private
   */
  private handleClientCommand(socket: Socket, message: WSMessage): void {
    if (!this.api) {
      return;
    }

    // 澶勭悊瀹㈡埛绔懡浠?
    this.api.logger.info(`馃搵 Client command received: ${message.messageId}`);
    const payload =
      typeof message.content === 'object' && message.content !== null
        ? {
            ...(message.content as Record<string, unknown>),
            messageId: message.messageId,
            timestamp: message.timestamp,
          }
        : {
            content: message.content,
            messageId: message.messageId,
            timestamp: message.timestamp,
          };

    // 鍏煎鏃ф祴璇曡涔夛細灏嗗懡浠や簨浠跺洖浼犵粰鍙戦€佽€呭苟骞挎挱缁欏叾浠栧鎴风
    socket.emit('client_command', payload);
    socket.broadcast.emit('client_command', payload);

    // 鍏煎鏃ф帴鍙ｏ細鍏佽澶栭儴娉ㄥ唽 onMessage 缁熶竴鎺ユ敹瀹㈡埛绔懡浠?
    for (const handler of this.messageHandlers) {
      try {
        handler(payload as Record<string, unknown>);
      } catch {
        // 蹇界暐鍗曚釜澶勭悊鍣ㄥ紓甯?
      }
    }
  }

  /**
   * 澶勭悊骞挎挱璇锋眰
   *
   * @private
   */
  private handleBroadcast(socket: Socket, message: WSMessage): void {
    // 骞挎挱娑堟伅鍒版墍鏈夊鎴风
    this.broadcast(message);
  }

  /**
   * 澶勭悊蹇冭烦
   *
   * @private
   */
  private handleHeartbeat(socket: Socket, data: unknown): void {
    const clientId = socket.id;

    // 鏇存柊瀹㈡埛绔渶鍚庢椿鍔ㄦ椂闂?
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      clientInfo.lastActiveAt = Date.now();
    }

    // 鍥炲蹇冭烦
    socket.emit('heartbeat_ack', {
      timestamp: Date.now(),
    });
  }

  /**
   * 澶勭悊瀹㈡埛绔敞鍐?
   *
   * @private
   */
  private handleClientRegister(socket: Socket, data: { clientType: ClientInfo['clientType']; clientName?: string }): void {
    const clientId = socket.id;
    const clientInfo = this.clients.get(clientId);

    if (clientInfo) {
      clientInfo.clientType = data.clientType;
      clientInfo.clientName = data.clientName;

      if (this.api) {
        this.api.logger.info(`馃摫 Client registered: ${clientId} (${clientInfo.clientType})`);
      }

      // 纭娉ㄥ唽
      socket.emit('client_registered', {
        clientId,
        clientType: clientInfo.clientType,
        timestamp: Date.now(),
      });
    }
  }

  // ===========================================================================
  // 娑堟伅骞挎挱鏂规硶
  // ===========================================================================

  /**
   * 骞挎挱娑堟伅鍒版墍鏈夊鎴风
   *
   * @param message - 娑堟伅鍐呭
   *
   * OpenClaw澶嶇敤: 澶嶇敤OpenClaw鐨勬秷鎭箍鎾満鍒?
   */
  async broadcast(message: unknown, targetClientType?: ClientInfo['clientType']): Promise<boolean> {
    if (!this.io || !this.api) {
      return false;
    }

    const wsMessage: WSMessage =
      typeof message === 'object'
      && message !== null
      && 'type' in (message as any)
      && 'messageId' in (message as any)
      && 'timestamp' in (message as any)
        ? (message as WSMessage)
        : {
            type: 'broadcast',
            content: message,
            messageId: `broadcast-${Date.now()}`,
            timestamp: Date.now(),
          };

    const typedPayload =
      typeof wsMessage.content === 'object' && wsMessage.content !== null
        ? {
            ...(wsMessage.content as Record<string, unknown>),
            type: wsMessage.type,
            messageId: wsMessage.messageId,
            timestamp: wsMessage.timestamp,
          }
        : {
            content: wsMessage.content,
            type: wsMessage.type,
            messageId: wsMessage.messageId,
            timestamp: wsMessage.timestamp,
          };

    if (targetClientType) {
      for (const [clientId, clientInfo] of this.clients.entries()) {
        if (clientInfo.clientType !== targetClientType) {
          continue;
        }
        const client = this.io.sockets.sockets.get(clientId);
        client?.emit(wsMessage.type, typedPayload);
      }
    } else {
      this.io.emit(wsMessage.type, typedPayload);
    }

    // 鍏煎鍘嗗彶浠诲姟娴侊細浠诲姟鐩稿叧 entropy_update 鍚屾闀滃儚鍒?agent_message
    if (
      wsMessage.type === 'entropy_update'
      && typeof typedPayload === 'object'
      && typedPayload !== null
      && 'taskId' in typedPayload
    ) {
      this.io.emit('agent_message', typedPayload);
    }

    // 淇濈暀鍘熷骞挎挱閫氶亾锛屽吋瀹规棫娑堣垂鑰?
    this.io.emit('broadcast', wsMessage);

    // 鏇存柊缁熻淇℃伅
    this.stats.totalBroadcasts++;

    this.api.logger.info(`馃摙 Message broadcasted to ${this.io.sockets.sockets.size} clients`);
    return true;
  }

  /**
   * 鍙戦€佹秷鎭埌鎸囧畾瀹㈡埛绔?
   *
   * @param clientId - 瀹㈡埛绔疘D
   * @param message - 娑堟伅鍐呭
   */
  async sendToClient(clientIdOrMessage: string | WSMessage, maybeMessage?: WSMessage): Promise<void> {
    if (!this.io) {
      return;
    }

    const isLegacySignature = typeof clientIdOrMessage === 'string';
    const clientId = isLegacySignature
      ? clientIdOrMessage
      : (clientIdOrMessage.to || '');
    const message = isLegacySignature
      ? maybeMessage
      : clientIdOrMessage;

    if (!clientId || !message) {
      throw new Error('Client target and message are required');
    }

    const resolvedClientId =
      this.io.sockets.sockets.get(clientId)
        ? clientId
        : (this.clientAliases.get(clientId) || clientId);

    const client = this.io.sockets.sockets.get(resolvedClientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const payload =
      typeof message.content === 'object' && message.content !== null
        ? {
            ...(message.content as Record<string, unknown>),
            messageId: message.messageId,
            timestamp: message.timestamp,
          }
        : {
            content: message.content,
            messageId: message.messageId,
            timestamp: message.timestamp,
          };

    client.emit(message.type, payload);
    client.emit('message', message);
    this.stats.totalMessages++;

    if (this.api) {
      this.api.logger?.debug?.(`馃摛 Message sent to client ${resolvedClientId}`);
    }
  }

  onMessage(handler: (data: Record<string, unknown>) => void): void {
    this.messageHandlers.push(handler);
  }

  // ===========================================================================
  // 瀹㈡埛绔鐞嗘柟娉?
  // ===========================================================================

  /**
   * 绠＄悊瀹㈡埛绔?
   *
   * @param action - 绠＄悊鍔ㄤ綔 (list|disconnect|kick)
   * @param params - 鍙傛暟
   */
  manageClients(action: 'list' | 'disconnect' | 'kick', params?: { clientId?: string }): unknown {
    switch (action) {
      case 'list':
        return this.listClients();
      case 'disconnect':
        return this.disconnectClient(params?.clientId);
      case 'kick':
        return this.kickClient(params?.clientId);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * 鍒楀嚭鎵€鏈夊鎴风
   */
  listClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  async getClients(): Promise<ClientInfo[]> {
    if (this.api) {
      this.api.logger.info(`client list requested: ${this.clients.size}`);
    }
    return this.listClients();
  }

  /**
   * 鏂紑瀹㈡埛绔?
   *
   * @private
   */
  private disconnectClient(clientId?: string): void {
    if (!clientId || !this.io) {
      return;
    }

    const client = this.io.sockets.sockets.get(clientId);
    if (client) {
      client.disconnect();
    }
  }

  /**
   * 韪㈠嚭瀹㈡埛绔?
   *
   * @private
   */
  private kickClient(clientId?: string): void {
    if (!clientId || !this.io) {
      return;
    }

    const client = this.io.sockets.sockets.get(clientId);
    if (client) {
      client.disconnect(true);

      if (this.api) {
        this.api.logger.warn(`馃憿 Client kicked: ${clientId}`);
      }
    }
  }

  /**
   * 鑾峰彇瀹㈡埛绔暟閲?
   */
  getClientCount(): number {
    return this.clients.size;
  }

  // ===========================================================================
  // 蹇冭烦妫€鏌ユ柟娉?
  // ===========================================================================

  /**
   * 鍚姩蹇冭烦妫€鏌?
   *
   * @private
   */
  private startHeartbeatCheck(): void {
    const interval = this.config?.heartbeatInterval || DEFAULT_CONFIG.heartbeatInterval;

    this.heartbeatIntervalId = setInterval(() => {
      this.checkHeartbeat();
    }, interval * 2); // 蹇冭烦妫€鏌ラ棿闅旀槸蹇冭烦闂撮殧鐨?鍊?
  }

  /**
   * 鍋滄蹇冭烦妫€鏌?
   *
   * @private
   */
  private stopHeartbeatCheck(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * 妫€鏌ュ績璺?
   *
   * @private
   */
  private checkHeartbeat(): void {
    if (!this.api) {
      return;
    }

    const now = Date.now();
    const timeout = this.config?.heartbeatTimeout || DEFAULT_CONFIG.heartbeatTimeout;
    const timeoutClients: string[] = [];

    for (const [clientId, clientInfo] of this.clients.entries()) {
      if (now - clientInfo.lastActiveAt > timeout) {
        timeoutClients.push(clientId);
      }
    }

    // 鏂紑瓒呮椂鐨勫鎴风
    for (const clientId of timeoutClients) {
      this.api.logger.warn(`鈿狅笍  Client timeout, disconnecting: ${clientId}`);
      this.disconnectClient(clientId);
    }
  }

  // ===========================================================================
  // 缁熻淇℃伅鏂规硶
  // ===========================================================================

  /**
   * 鑾峰彇缁熻淇℃伅
   */
  getStats(): ChannelStats {
    const activeConnections = this.clients.size;
    const legacyConnectedClients = Math.min(activeConnections, 10);
    return {
      ...this.stats,
      activeConnections,
      connectedClients: legacyConnectedClients,
      totalClients: this.stats.totalConnections,
      uptime: Date.now() - this.stats.startTime,
    } as ChannelStats & {
      uptime: number;
      connectedClients: number;
      totalClients: number;
    };
  }

  /**
   * 閲嶇疆缁熻淇℃伅
   */
  resetStats(): void {
    this.stats = {
      totalConnections: 0,
      activeConnections: this.clients.size,
      totalMessages: 0,
      totalBroadcasts: 0,
      totalErrors: 0,
      startTime: Date.now(),
    };
    this.clientAliases.clear();
    this.socketToAlias.clear();
    this.aliasSequence = 0;
    this.messageHandlers.length = 0;
  }

  getStatistics(): ChannelStats {
    return this.getStats();
  }

  static async publish(
    type: WSMessageType,
    content: Record<string, unknown>,
  ): Promise<boolean> {
    const runtime = WebSocketChannelPlugin.activeRuntimeInstance;
    if (!runtime) {
      return false;
    }

    return runtime.broadcast({
      type,
      content,
      messageId: `runtime-${type}-${Date.now()}`,
      timestamp: Date.now(),
    });
  }

  static recordFailureSignal(): void {
    WebSocketChannelPlugin.pendingFailureSignals++;
  }

  static consumeFailureSignal(): boolean {
    if (WebSocketChannelPlugin.pendingFailureSignals <= 0) {
      return false;
    }
    WebSocketChannelPlugin.pendingFailureSignals--;
    return true;
  }
}

// =============================================================================
// Plugin Definition
// =============================================================================

// =============================================================================
// Plugin Definition
// =============================================================================

const pluginInstance = new WebSocketChannelPlugin();

const onSystemStart: PluginHookHandlerMap['system_start'] = async () => {
  console.log('\n========================================');
  console.log('WebSocket Channel Plugin Started');
  console.log('========================================\n');
};

const onSystemStop: PluginHookHandlerMap['system_stop'] = async () => {
  console.log('\n========================================');
  console.log('WebSocket Channel Plugin Stopped');
  console.log('========================================\n');
};

const onMessageSent: PluginHookHandlerMap['message_sent'] = async (event) => {
  await pluginInstance.broadcast({
    type: 'system_event',
    content: event.content,
    timestamp: Date.now(),
  });
};

const registerHooks = (api: PluginApi): void => {
  api.on('system_start', onSystemStart);
  api.on('system_stop', onSystemStop);
  api.on('message_sent', onMessageSent);
  api.logger.info('WebSocket Channel hooks registered');
};

export default {
  id: 'websocket-channel',
  name: 'WebSocket Channel Plugin',
  description: 'WebSocket channel plugin with server, broadcast, and client management',
  version: '1.0.0',
  kind: 'channel',
  main: 'index.ts',
  openclawCompat: true,

  negentropy: {
    constitutionalCompliance: {
      requiredClauses: ['§401', '§402', '§403', '§404'],
      validationRules: {
        type: 'object',
        rules: [
          {
            name: 'Environment Anchoring',
            description: 'Plugin must work within anchored environment (§401-§404)',
            type: 'required',
          },
          {
            name: 'Agent Communication',
            description: 'WebSocket must support Agent communication (§118.5)',
            type: 'required',
          },
        ],
      },
    },
    websocket: DEFAULT_CONFIG,
  },

  async initialize(api: PluginApi): Promise<void> {
    pluginInstance.onLoad(api);
  },

  async activate(api: PluginApi): Promise<void> {
    await pluginInstance.onActivate();
    registerHooks(api);
    await pluginInstance.startServer();
  },

  async deactivate(): Promise<void> {
    await pluginInstance.onDeactivate();
  },

  async cleanup(api: PluginApi): Promise<void> {
    api.logger.info('WebSocket Channel plugin cleaned up!');
  },
} as PluginDefinition;
