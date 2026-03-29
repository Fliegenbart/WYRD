import type { MessageEnvelope } from '@wyrd/protocol';

export interface Transport {
  /** Send a message to an agent */
  send(agentId: string, message: MessageEnvelope): Promise<void>;

  /** Listen for incoming messages */
  onMessage(handler: (message: MessageEnvelope) => void): void;

  /** Connect to a peer agent's endpoint */
  connect(endpoint: string, agentId: string): Promise<void>;

  /** Disconnect from a peer */
  disconnect(agentId: string): Promise<void>;

  /** Start listening for inbound connections */
  listen(port: number): Promise<void>;

  /** Shut down all connections */
  close(): Promise<void>;
}

export interface TransportEvents {
  message: (message: MessageEnvelope) => void;
  connected: (agentId: string) => void;
  disconnected: (agentId: string) => void;
  error: (error: Error) => void;
}
