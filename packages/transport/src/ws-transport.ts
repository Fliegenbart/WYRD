import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'node:events';
import type { MessageEnvelope } from '@agentnet/protocol';
import type { Transport, TransportEvents } from './transport.js';

interface PeerConnection {
  ws: WebSocket;
  agentId: string;
  endpoint: string;
  reconnectAttempts: number;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

export interface WebSocketTransportOptions {
  /** Max reconnect attempts before giving up (default: 10) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  reconnectBaseDelay?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
}

export class WebSocketTransport extends EventEmitter implements Transport {
  private server: WebSocketServer | null = null;
  private peers = new Map<string, PeerConnection>();
  private messageHandlers: Array<(message: MessageEnvelope) => void> = [];
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private opts: Required<WebSocketTransportOptions>;

  constructor(options: WebSocketTransportOptions = {}) {
    super();
    this.opts = {
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      reconnectBaseDelay: options.reconnectBaseDelay ?? 1000,
      heartbeatInterval: options.heartbeatInterval ?? 30_000,
    };
  }

  async send(agentId: string, message: MessageEnvelope): Promise<void> {
    const peer = this.peers.get(agentId);
    if (!peer || peer.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`No active connection to agent ${agentId}`);
    }
    const data = JSON.stringify(message);
    peer.ws.send(data);
  }

  onMessage(handler: (message: MessageEnvelope) => void): void {
    this.messageHandlers.push(handler);
  }

  async connect(endpoint: string, agentId: string): Promise<void> {
    if (this.peers.has(agentId)) {
      const existing = this.peers.get(agentId)!;
      if (existing.ws.readyState === WebSocket.OPEN) return;
      existing.ws.close();
    }

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(endpoint);
      const peer: PeerConnection = {
        ws,
        agentId,
        endpoint,
        reconnectAttempts: 0,
      };

      ws.on('open', () => {
        peer.reconnectAttempts = 0;
        this.peers.set(agentId, peer);
        this.emit('connected', agentId);
        resolve();
      });

      ws.on('message', (data) => {
        this.handleIncomingData(data);
      });

      ws.on('close', () => {
        this.emit('disconnected', agentId);
        this.scheduleReconnect(peer);
      });

      ws.on('error', (err) => {
        this.emit('error', err);
        if (ws.readyState !== WebSocket.OPEN) {
          reject(err);
        }
      });
    });
  }

  async disconnect(agentId: string): Promise<void> {
    const peer = this.peers.get(agentId);
    if (!peer) return;
    if (peer.reconnectTimer) clearTimeout(peer.reconnectTimer);
    peer.reconnectAttempts = this.opts.maxReconnectAttempts; // prevent reconnect
    peer.ws.close();
    this.peers.delete(agentId);
  }

  async listen(port: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.server = new WebSocketServer({ port });

      this.server.on('connection', (ws) => {
        ws.on('message', (data) => {
          this.handleIncomingData(data);

          // Track inbound peer by their `from` field
          try {
            const msg = JSON.parse(data.toString()) as MessageEnvelope;
            if (msg.from && !this.peers.has(msg.from)) {
              this.peers.set(msg.from, {
                ws,
                agentId: msg.from,
                endpoint: '',
                reconnectAttempts: 0,
              });
              this.emit('connected', msg.from);
            }
          } catch {
            // ignore parse errors for tracking
          }
        });

        ws.on('close', () => {
          // Remove peer by finding which one had this ws
          for (const [id, peer] of this.peers) {
            if (peer.ws === ws) {
              this.peers.delete(id);
              this.emit('disconnected', id);
              break;
            }
          }
        });

        // Respond to pings with pongs (ws handles this automatically)
      });

      this.server.on('listening', () => {
        this.startHeartbeat();
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    // Stop reconnection attempts and close all peers
    for (const [, peer] of this.peers) {
      if (peer.reconnectTimer) clearTimeout(peer.reconnectTimer);
      peer.reconnectAttempts = this.opts.maxReconnectAttempts;
      peer.ws.close();
    }
    this.peers.clear();

    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  /** Number of active peer connections */
  get peerCount(): number {
    return this.peers.size;
  }

  /** List connected agent IDs */
  get connectedPeers(): string[] {
    return Array.from(this.peers.keys());
  }

  private handleIncomingData(data: unknown): void {
    try {
      const message = JSON.parse(data!.toString()) as MessageEnvelope;
      for (const handler of this.messageHandlers) {
        handler(message);
      }
      this.emit('message', message);
    } catch (err) {
      this.emit('error', new Error(`Failed to parse message: ${err}`));
    }
  }

  private scheduleReconnect(peer: PeerConnection): void {
    if (peer.reconnectAttempts >= this.opts.maxReconnectAttempts) return;
    if (!peer.endpoint) return; // inbound connections don't reconnect

    const delay = this.opts.reconnectBaseDelay * Math.pow(2, peer.reconnectAttempts);
    peer.reconnectAttempts++;

    peer.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect(peer.endpoint, peer.agentId);
      } catch {
        // connect() will schedule another retry via the close handler
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [, peer] of this.peers) {
        if (peer.ws.readyState === WebSocket.OPEN) {
          peer.ws.ping();
        }
      }
    }, this.opts.heartbeatInterval);
  }
}
