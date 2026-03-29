import { EventEmitter } from 'node:events';
import { ulid } from 'ulid';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type {
  MessageEnvelope,
  TaskRequestBody,
  TaskCancelBody,
} from '@wyrd/protocol';
import { PROTOCOL_VERSION } from '@wyrd/protocol';
import {
  generateIdentity,
  loadIdentity,
  signMessage,
  verifyMessage,
  type AgentIdentity,
} from '@wyrd/identity';
import { WebSocketTransport } from '@wyrd/transport';
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
  private httpServer?: ReturnType<typeof serve>;
  private _httpPort = 0;

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

  /** Start the agent: identity, HTTP server (with /.well-known/wyrd.json), WebSocket, registry */
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

    // Start HTTP server (serves /.well-known/wyrd.json + task API)
    const wsPort = this.config.port ?? 0;
    await this.startHttpServer(wsPort);

    // Listen for incoming WebSocket connections on wsPort + 1 (or same port range)
    const actualWsPort = this._httpPort + 1;
    await this.transport.listen(actualWsPort);

    // Handle incoming messages
    this.transport.onMessage((msg) => this.handleMessage(msg));

    // Announce to registry if configured
    if (this.config.registry) {
      await this.announce();
      this.registryInterval = setInterval(() => this.announce().catch(() => {}), 5 * 60 * 1000);
    }

    this.started = true;
    this.emit('started', { id: this.identity.id });
  }

  /** Stop the agent gracefully */
  async stop(): Promise<void> {
    if (!this.started) return;

    if (this.registryInterval) clearInterval(this.registryInterval);

    for (const [, controller] of this.activeTasks) {
      controller.abort();
    }
    this.activeTasks.clear();

    await this.transport.close();
    if (this.httpServer) this.httpServer.close();
    this.started = false;
    this.emit('stopped');
  }

  /** HTTP port the agent is listening on */
  get port(): number {
    return this._httpPort;
  }

  /** WebSocket port */
  get wsPort(): number {
    return this._httpPort + 1;
  }

  /** The agent's HTTP base URL */
  get url(): string {
    return `http://localhost:${this._httpPort}`;
  }

  /** The agent's WebSocket endpoint URL */
  get endpoint(): string {
    return `ws://localhost:${this.wsPort}`;
  }

  /** Generate the WYRD card (/.well-known/wyrd.json) */
  getWyrdCard(): object {
    const wireCapabilities = Array.from(this.capabilities.values()).map(toWireCapability);
    return {
      // WYRD standard fields
      wyrd: '1.0',
      id: this.identity.id,
      name: this.config.name,
      description: this.config.description ?? '',
      url: this.url,
      endpoint: this.endpoint,
      publicKey: this.identity.id, // base58-encoded Ed25519 public key

      capabilities: wireCapabilities,

      // A2A-compatible fields
      provider: {
        organization: 'WYRD Agent',
        url: this.url,
      },
      version: '0.1.0',
      skills: wireCapabilities.map((cap) => ({
        id: cap.id,
        name: cap.name,
        description: cap.description,
        tags: cap.tags,
        inputSchema: cap.inputSchema,
        outputSchema: cap.outputSchema,
      })),

      // Connection info
      transport: {
        websocket: this.endpoint,
        http: `${this.url}/v1/task`,
      },
    };
  }

  // ── HTTP Server ──────────────────────────────────────────────────────────

  private async startHttpServer(basePort: number): Promise<void> {
    const app = new Hono();
    app.use('*', cors());

    // /.well-known/wyrd.json — the agent's identity card
    app.get('/.well-known/wyrd.json', (c) => {
      return c.json(this.getWyrdCard());
    });

    // Health check
    app.get('/health', (c) => c.json({ status: 'ok', agent: this.config.name, id: this.identity.id }));

    // HTTP Task endpoint — allows direct task submission without WebSocket
    app.post('/v1/task', async (c) => {
      const body = await c.req.json();
      const { capabilityId, input, taskId: providedTaskId } = body;

      const capability = this.capabilities.get(capabilityId);
      if (!capability) {
        return c.json({ error: 'Unknown capability', capabilityId }, 404);
      }

      const inputResult = capability.input.safeParse(input);
      if (!inputResult.success) {
        return c.json({ error: 'Invalid input', details: inputResult.error.message }, 400);
      }

      const taskId = providedTaskId ?? ulid();
      const controller = new AbortController();
      this.activeTasks.set(taskId, controller);

      const progressUpdates: Array<{ percent: number; status: string }> = [];

      const log: TaskLogger = {
        info: (message, ...args) => this.emit('log', 'info', taskId, message, ...args),
        warn: (message, ...args) => this.emit('log', 'warn', taskId, message, ...args),
        error: (message, ...args) => this.emit('log', 'error', taskId, message, ...args),
        debug: (message, ...args) => this.emit('log', 'debug', taskId, message, ...args),
      };

      const ctx: TaskContext = {
        taskId,
        requesterId: body.agentId ?? 'http-client',
        capabilityId,
        progress: (percent, status) => { progressUpdates.push({ percent, status }); },
        delegate: async () => { throw new Error('Delegation not yet implemented'); },
        signal: controller.signal,
        log,
      };

      const startTime = Date.now();
      try {
        this.emit('task:start', { taskId, capabilityId });
        const output = await capability.handler(inputResult.data, ctx);
        const durationMs = Date.now() - startTime;
        this.emit('task:complete', { taskId, output, durationMs });

        return c.json({
          taskId,
          status: 'success',
          output,
          metrics: { durationMs },
          progress: progressUpdates,
          agent: { id: this.identity.id, name: this.config.name },
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const error = err instanceof Error ? err : new Error(String(err));
        this.emit('task:error', { taskId, error });

        return c.json({
          taskId,
          status: 'error',
          error: { code: 'HANDLER_ERROR', message: error.message },
          metrics: { durationMs },
        }, 500);
      } finally {
        this.activeTasks.delete(taskId);
      }
    });

    // List capabilities
    app.get('/v1/capabilities', (c) => {
      return c.json({
        capabilities: Array.from(this.capabilities.values()).map(toWireCapability),
      });
    });

    return new Promise<void>((resolve) => {
      this.httpServer = serve({ fetch: app.fetch, port: basePort }, (info) => {
        this._httpPort = info.port;
        resolve();
      });
    });
  }

  // ── Registry Announcement ────────────────────────────────────────────────

  private async announce(): Promise<void> {
    if (!this.config.registry) return;

    const wireCapabilities = Array.from(this.capabilities.values()).map(toWireCapability);

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
          type: 'announce',
          capabilities: wireCapabilities,
          endpoint: this.endpoint,
          meta: {
            name: this.config.name,
            description: this.config.description,
            url: this.url,
          },
          ttl: 3600,
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

  // ── WebSocket Message Handling ───────────────────────────────────────────

  private async handleMessage(msg: MessageEnvelope): Promise<void> {
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

    const inputResult = capability.input.safeParse(body.input);
    if (!inputResult.success) {
      await this.sendReject(msg.from, body.taskId, 'other', `Invalid input: ${inputResult.error.message}`);
      return;
    }

    await this.sendAccept(msg.from, body.taskId);

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
      delegate: async () => { throw new Error('Delegation not yet implemented'); },
      signal: controller.signal,
      log,
    };

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
      const code = controller.signal.aborted ? 'CANCELLED' : 'HANDLER_ERROR';
      const message = controller.signal.aborted ? 'Task was cancelled' : error.message;
      await this.sendResult(msg.from, body.taskId, 'error', undefined, { code, message }, { durationMs });
      this.emit('task:error', { taskId: body.taskId, error });
    } finally {
      this.activeTasks.delete(body.taskId);
    }
  }

  private handleTaskCancel(msg: MessageEnvelope): void {
    const body = msg.body as TaskCancelBody;
    const controller = this.activeTasks.get(body.taskId);
    if (controller) controller.abort();
  }

  private async sendAccept(to: string, taskId: string): Promise<void> {
    await this.transport.send(to, await this.createMessage(to, 'task.accept', { type: 'task.accept', taskId }, taskId));
  }

  private async sendReject(to: string, taskId: string, reason: string, message?: string): Promise<void> {
    await this.transport.send(to, await this.createMessage(to, 'task.reject', { type: 'task.reject', taskId, reason, message }, taskId));
  }

  private async sendProgress(to: string, taskId: string, progress: number, status: string, partialResult?: unknown): Promise<void> {
    await this.transport.send(to, await this.createMessage(to, 'task.progress', { type: 'task.progress', taskId, progress, status, partialResult }, taskId));
  }

  private async sendResult(to: string, taskId: string, status: 'success' | 'error' | 'partial', output?: unknown, error?: { code: string; message: string }, metrics?: { durationMs: number; tokensUsed?: number }): Promise<void> {
    await this.transport.send(to, await this.createMessage(to, 'task.result', { type: 'task.result', taskId, status, output, error, metrics }, taskId));
  }

  private async createMessage(to: string, type: MessageEnvelope['type'], body: unknown, re?: string): Promise<MessageEnvelope> {
    return signMessage(this.identity, {
      v: PROTOCOL_VERSION as 1, type, id: ulid(), from: this.identity.id, to, ts: Date.now(), re, body,
    });
  }
}
