/**
 * WebSocket服务器
 * 
 * @module websocket/server
 */

import { WebSocketServer as WSServer, WebSocket, RawData } from 'ws';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

interface Client {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  subscribedTopics: Set<string>;
  connectedAt: number;
}

interface Message {
  type: string;
  payload: any;
  timestamp: number;
}

export class WebSocketServer {
  private wss: WSServer;
  private clients: Map<string, Client> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WSServer({ server, path: '/ws' });
    this.setupServer();
    this.startHeartbeat();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      const client: Client = {
        id: clientId,
        ws,
        isAlive: true,
        subscribedTopics: new Set(),
        connectedAt: Date.now(),
      };

      this.clients.set(clientId, client);
      logger.info(`Client connected: ${clientId}`);

      // 发送连接确认
      this.send(ws, {
        type: 'connected',
        payload: { clientId },
      });

      ws.on('message', (data: RawData) => {
        this.handleMessage(client, data);
      });

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`Client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for ${clientId}:`, error);
      });
    });
  }

  private handleMessage(client: Client, data: RawData): void {
    try {
      const message = JSON.parse(data.toString());
      logger.debug(`Message from ${client.id}:`, message.type);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(client, message.payload);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(client, message.payload);
          break;
        case 'ping':
          this.send(client.ws, { type: 'pong', payload: { timestamp: Date.now() } });
          break;
        default:
          this.handleCustomMessage(client, message);
      }
    } catch (error) {
      logger.error('Failed to parse message:', error);
    }
  }

  private handleSubscribe(client: Client, payload: { topic: string }): void {
    client.subscribedTopics.add(payload.topic);
    this.send(client.ws, {
      type: 'subscribed',
      payload: { topic: payload.topic },
    });
  }

  private handleUnsubscribe(client: Client, payload: { topic: string }): void {
    client.subscribedTopics.delete(payload.topic);
    this.send(client.ws, {
      type: 'unsubscribed',
      payload: { topic: payload.topic },
    });
  }

  private handleCustomMessage(client: Client, message: Message): void {
    // 广播给订阅了相关主题的客户端
    this.broadcast(message.type, message.payload, client.id);
  }

  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now(),
      }));
    }
  }

  broadcast(type: string, payload: any, excludeClientId?: string): void {
    const message = { type, payload, timestamp: Date.now() };
    const data = JSON.stringify(message);

    this.clients.forEach((client, id) => {
      if (id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        if (client.subscribedTopics.has(type) || client.subscribedTopics.has('*')) {
          client.ws.send(data);
        }
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          logger.info(`Terminating dead connection: ${id}`);
          client.ws.terminate();
          this.clients.delete(id);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000);
  }

  getStats(): { totalClients: number; clients: any[] } {
    return {
      totalClients: this.clients.size,
      clients: Array.from(this.clients.values()).map((c) => ({
        id: c.id,
        subscribedTopics: Array.from(c.subscribedTopics),
        connectedAt: c.connectedAt,
      })),
    };
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}
