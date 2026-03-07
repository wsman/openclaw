/**
 * WebSocket test mock setup.
 */

type WsOpenEvent = Record<string, never>;
type WsErrorEvent = Record<string, never>;

type WsMessageEvent = {
  data: Buffer;
};

type WsCloseEvent = {
  code: number;
  reason: string;
  wasClean: boolean;
};

class MockWebSocket {
  private url: string;
  private _readyState = MockWebSocket.CONNECTING;
  private _onopen: ((event: WsOpenEvent) => void) | null = null;
  private _onmessage: ((event: WsMessageEvent) => void) | null = null;
  private _onclose: ((event: WsCloseEvent) => void) | null = null;
  private _onerror: ((event: WsErrorEvent) => void) | null = null;
  private mockServer: MockWebSocketServer | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;

    setTimeout(() => {
      this._readyState = MockWebSocket.OPEN;
      this._onopen?.({});
      this.mockServer?.sendConnectChallenge(this);
    }, 10);
  }

  get readyState(): number {
    return this._readyState;
  }

  set onopen(handler: ((event: WsOpenEvent) => void) | null) {
    this._onopen = handler;
  }

  set onmessage(handler: ((event: WsMessageEvent) => void) | null) {
    this._onmessage = handler;
  }

  set onclose(handler: ((event: WsCloseEvent) => void) | null) {
    this._onclose = handler;
  }

  set onerror(handler: ((event: WsErrorEvent) => void) | null) {
    this._onerror = handler;
  }

  get onopen() {
    return this._onopen;
  }

  get onmessage() {
    return this._onmessage;
  }

  get onclose() {
    return this._onclose;
  }

  get onerror() {
    return this._onerror;
  }

  send(data: string | ArrayBuffer): void {
    if (this._readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    this.mockServer?.handleMessage(this, data);
  }

  close(code?: number, reason?: string): void {
    this._readyState = MockWebSocket.CLOSING;

    setTimeout(() => {
      this._readyState = MockWebSocket.CLOSED;
      this._onclose?.({
        code: code ?? 1000,
        reason: reason ?? '',
        wasClean: true,
      });
    }, 10);
  }

  setMockServer(server: MockWebSocketServer): void {
    this.mockServer = server;
  }

  triggerMessage(data: string): void {
    this._onmessage?.({ data: Buffer.from(data) });
  }
}

class MockWebSocketServer {
  private connections: Set<MockWebSocket> = new Set();

  addConnection(ws: MockWebSocket): void {
    this.connections.add(ws);
  }

  removeConnection(ws: MockWebSocket): void {
    this.connections.delete(ws);
  }

  handleMessage(ws: MockWebSocket, data: string | ArrayBuffer): void {
    try {
      const raw = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
      const message = JSON.parse(raw);

      if (message.type === 'request') {
        const response = {
          type: 'response',
          id: message.id,
          ok: true,
          result:
            message.method === 'ping'
              ? { pong: true, timestamp: Date.now() }
              : { processed: true },
        };

        setTimeout(() => ws.triggerMessage(JSON.stringify(response)), 10);
      }
    } catch (error) {
      console.error('MockWebSocketServer error:', error);
    }
  }

  sendConnectChallenge(ws: MockWebSocket): void {
    const challenge = {
      type: 'event',
      event: 'connect.challenge',
      payload: {
        challenge: 'authenticate',
        required: true,
        authMethods: ['token', 'password'],
      },
    };

    setTimeout(() => ws.triggerMessage(JSON.stringify(challenge)), 10);
  }

  broadcast(data: string): void {
    this.connections.forEach((ws) => {
      if (ws.readyState === MockWebSocket.OPEN) {
        ws.triggerMessage(data);
      }
    });
  }

  closeAll(): void {
    this.connections.forEach((ws) => ws.close());
    this.connections.clear();
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

export { MockWebSocket as WebSocket, MockWebSocketServer };

(global as any).WebSocket = MockWebSocket;
