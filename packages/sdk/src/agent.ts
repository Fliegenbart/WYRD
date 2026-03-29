import { EventEmitter } from 'node:events';
import { ulid } from 'ulid';
import type {
  MessageEnvelope,
  TaskRequestBody,
  TaskProgressBody,
  TaskResultBody,
  TaskCancelBody,
} from '@agentnet/protocol';
import { PROTOCOL_VERSION, REGISTRY_TARGET } from '@agentnet/protocol';
import {
  generateIdentity,
  loadIdentity,
  signMessage,
  verifyMessage,
  type AgentIdentity,
} from '@agentnet/identity';
import { WebSocketTransport } from '@agentnet/transport';
import type { AgentConfig, CapabilityDefinition, TaskContext, TaskLogger } from './types.js';
import { toWireCapability } from './capability.js';

export class Agent extends EventEmitter {
  readonly config: AgentConfig;
  private identity!: AgentIdentity;
  private transport: WebSocketTransport;
  private capabilities = new Map<string, CapabilityDefinition>();
  private activeTasks = new Map<string, AbortController>();
  private started = false;
  private registryInterval?: ReturnType<typeof setInterval>;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.transport = new WebSocketTransport();

    for (const cap of config.capabilities) {
      this.capabilities.set(cap.id, cap);
    }
  }

  /** The agent's unique ID (base58 public key) */
  get id(): string {
    return this.identity?.id ?? '';
  }

  /** Start the agent: generate/load identity, listen for connections, announce to registry */
  async start(): Promise<void> {
    if (this.started) return;

    // Resolve identity
    if (this.config.identity) {
      this.identity = this.config.identity;
    } else if (this.config.privateKey) {
      this.identity = await loadIdentity(this.config.privateKey);
    } else {
      this.identity = await generateIdentity();
    }

    // Listen for incoming WebSocket connections
    const port = this.config.port ?? 0;
    await this.transport.listen(port);

    // Handle incoming messages
    this.transport.onMessage((msg) => this.handleMessage(msg));

    // Announce to registry if configured
    if (this.config.registry) {
      await this.announce();
      // Re-announce every 5 minutes
      this.registryInterval = setInterval(() => this.announce().catch(() => {}), 5 * 60 * 1000);
    }

    this.started = true;
    this.emit('started', { id: this.identity.id });
  }

  /** Stop the agent gracefully */
  async stop(): Promise<void> {
    if (!this.started) return;

    if (this.registryInterval) clearInterval(this.registryInterval);

    // Cancel all active tasks
    for (const [, controller] of this.activeTasks) {
      controller.abort();
    }
    this.activeTasks.clear();

    await this.transport.close();
    this.started = false;
    this.emit('stopped');
  }

  /** Get the port the agent is listening on */
  get port(): number {
    return (this.transport as any).server?.address()?.port ?? 0;
  }

  /** Get the agent's WebSocket endpoint URL */
  get endpoint(): string {
    return `ws://localhost:${this.port}`;
  }

  private async announce(): Promise<void> {
    if (!this.config.registry) return;

    const wireCapabilities = Array.from(this.capabilities.values()).map(toWireCapability);

    const body = {
      type: 'announce' as const,
      capabilities: wireCapabilities,
      endpoint: this.endpoint,
      meta: {
        name: this.config.name,
        description: this.config.description,
      },
      ttl: 3600,
    };

    try {
      const response = await fetch(`${this.config.registry}/v1/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': this.identity.id,
          'X-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify({
          agentId: this.identity.id,
          ...body,
        }),
      });

      if (!response.ok) {
        throw new Error(`Registry announcement failed: ${response.status}`);
      }

      this.emit('announced');
    } catch (err) {
      this.emit('error', err);
    }
  }

  private async handleMessage(msg: MessageEnvelope): Promise<void> {
    // Verify signature
    const valid = await verifyMessage(msg);
    if (!valid) {
      this.emit('error', new Error(`Invalid signature from ${msg.from}`));
      return;
    }

    switch (msg.type) {
      case 'task.request':
        await this.handleTaskRequest(msg);
        break;
      case 'task.cancel':
        this.handleTaskCancel(msg);
        break;
      default:
        this.emit('message', msg);
    }
  }

  private async handleTaskRequest(msg: MessageEnvelope): Promise<void> {
    const body = msg.body as TaskRequestBody;
    const capability = this.capabilities.get(body.capabilityId);

    if (!capability) {
      await this.sendReject(msg.from, body.taskId, 'unsupported', `Unknown capability: ${body.capabilityId}`);
      return;
    }

    // Validate input
    const inputResult = capability.input.safeParse(body.input);
    if (!inputResult.success) {
      await this.sendReject(msg.from, body.taskId, 'other', `Invalid input: ${inputResult.error.message}`);
      return;
    }

    // Accept the task
    await this.sendAccept(msg.from, body.taskId);

    // Set up task context
    const controller = new AbortController();
    this.activeTasks.set(body.taskId, controller);

    const log: TaskLogger = {
      info: (message, ...args) => this.emit('log', 'info', body.taskId, message, ...args),
      warn: (message, ...args) => this.emit('log', 'warn', body.taskId, message, ...args),
      error: (message, ...args) => this.emit('log', 'error', body.taskId, message, ...args),
      debug: (message, ...args) => this.emit('log', 'debug', body.taskId, message, ...args),
    };

    const ctx: TaskContext = {
      taskId: body.taskId,
      requesterId: msg.from,
      capabilityId: body.capabilityId,
      progress: (percent, status, partialResult) => {
        this.sendProgress(msg.from, body.taskId, percent, status, partialResult).catch(() => {});
      },
      delegate: async <T>(agentId: string, capId: string, input: unknown): Promise<T> => {
        // TODO: implement delegation via AgentClient
        throw new Error('Delegation not yet implemented');
      },
      signal: controller.signal,
      log,
    };

    // Execute the handler
    const startTime = Date.now();
    try {
      this.emit('task:start', { taskId: body.taskId, capabilityId: body.capabilityId });
      const output = await capability.handler(inputResult.data, ctx);
      const durationMs = Date.now() - startTime;

      await this.sendResult(msg.from, body.taskId, 'success', output, undefined, { durationMs });
      this.emit('task:complete', { taskId: body.taskId, output, durationMs });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const error = err instanceof Error ? err : new Error(String(err));

      if (controller.signal.aborted) {
        await this.sendResult(msg.from, body.taskId, 'error', undefined, {
          code: 'CANCELLED',
          message: 'Task was cancelled',
        }, { durationMs });
      } else {
        await this.sendResult(msg.from, body.taskId, 'error', undefined, {
          code: 'HANDLER_ERROR',
          message: error.message,
        }, { durationMs });
      }

      this.emit('task:error', { taskId: body.taskId, error });
    } finally {
      this.activeTasks.delete(body.taskId);
    }
  }

  private handleTaskCancel(msg: MessageEnvelope): void {
    const body = msg.body as TaskCancelBody;
    const controller = this.activeTasks.get(body.taskId);
    if (controller) {
      controller.abort();
    }
  }

  private async sendAccept(to: string, taskId: string): Promise<void> {
    const msg = await this.createMessage(to, 'task.accept', {
      type: 'task.accept',
      taskId,
    }, taskId);
    await this.transport.send(to, msg);
  }

  private async sendReject(to: string, taskId: string, reason: string, message?: string): Promise<void> {
    const msg = await this.createMessage(to, 'task.reject', {
      type: 'task.reject',
      taskId,
      reason,
      message,
    }, taskId);
    await this.transport.send(to, msg);
  }

  private async sendProgress(
    to: string,
    taskId: string,
    progress: number,
    status: string,
    partialResult?: unknown,
  ): Promise<void> {
    const msg = await this.createMessage(to, 'task.progress', {
      type: 'task.progress',
      taskId,
      progress,
      status,
      partialResult,
    }, taskId);
    await this.transport.send(to, msg);
  }

  private async sendResult(
    to: string,
    taskId: string,
    status: 'success' | 'error' | 'partial',
    output?: unknown,
    error?: { code: string; message: string },
    metrics?: { durationMs: number; tokensUsed?: number },
  ): Promise<void> {
    const msg = await this.createMessage(to, 'task.result', {
      type: 'task.result',
      taskId,
      status,
      output,
      error,
      metrics,
    }, taskId);
    await this.transport.send(to, msg);
  }

  private async createMessage(
    to: string,
    type: MessageEnvelope['type'],
    body: unknown,
    re?: string,
  ): Promise<MessageEnvelope> {
    const unsigned = {
      v: PROTOCOL_VERSION as 1,
      type,
      id: ulid(),
      from: this.identity.id,
      to,
      ts: Date.now(),
      re,
      body,
    };
    return signMessage(this.identity, unsigned);
  }
}
