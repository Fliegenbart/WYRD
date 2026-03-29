import { ulid } from 'ulid';
import type { MessageEnvelope, TaskResultBody } from '@wyrd/protocol';
import { PROTOCOL_VERSION } from '@wyrd/protocol';
import {
  generateIdentity,
  loadIdentity,
  signMessage,
  type AgentIdentity,
} from '@wyrd/identity';
import { WebSocketTransport } from '@wyrd/transport';
import type { DiscoverOptions, DiscoveredAgent, TaskStreamEvent } from './types.js';

export interface AgentClientConfig {
  /** Registry URL (optional — not needed for direct P2P connections) */
  registry?: string;
  /** Pre-loaded identity (auto-generated if not provided) */
  identity?: AgentIdentity;
  /** Private key hex */
  privateKey?: string;
}

/** Cached WYRD card info */
interface WyrdCard {
  id: string;
  name: string;
  endpoint: string;
  url: string;
  capabilities: any[];
}

export class AgentClient {
  private config: AgentClientConfig;
  private identity!: AgentIdentity;
  private transport: WebSocketTransport;
  private initialized = false;
  private wyrdCardCache = new Map<string, WyrdCard>();
  private pendingTasks = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      onProgress?: (event: TaskStreamEvent) => void;
    }
  >();

  constructor(config: AgentClientConfig) {
    this.config = config;
    this.transport = new WebSocketTransport();
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    if (this.config.identity) {
      this.identity = this.config.identity;
    } else if (this.config.privateKey) {
      this.identity = await loadIdentity(this.config.privateKey);
    } else {
      this.identity = await generateIdentity();
    }

    this.transport.onMessage((msg) => this.handleMessage(msg));
    this.initialized = true;
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  /** Discover agents via registry */
  async discover(options: DiscoverOptions = {}): Promise<DiscoveredAgent[]> {
    if (!this.config.registry) throw new Error('No registry configured. Use directTask() for P2P connections.');
    await this.init();

    const params = new URLSearchParams();
    if (options.tags?.length) params.set('tags', options.tags.join(','));
    if (options.text) params.set('text', options.text);
    if (options.capabilityId) params.set('capabilityId', options.capabilityId);
    if (options.minReputation !== undefined) params.set('minReputation', options.minReputation.toString());
    if (options.maxPricePerTask !== undefined) params.set('maxPricePerTask', options.maxPricePerTask.toString());
    if (options.limit !== undefined) params.set('limit', options.limit.toString());

    const url = `${this.config.registry}/v1/discover?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Discovery failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { agents: DiscoveredAgent[]; total: number };
    return data.agents;
  }

  // ── P2P: Fetch WYRD Card ───────────────────────────────────────────────────

  /**
   * Fetch a WYRD card from any agent's URL.
   * This is the P2P discovery mechanism — no registry needed.
   *
   * @param agentUrl - The agent's HTTP base URL (e.g., "http://localhost:4211" or "https://weather.example.com")
   */
  async fetchWyrdCard(agentUrl: string): Promise<WyrdCard> {
    const cached = this.wyrdCardCache.get(agentUrl);
    if (cached) return cached;

    const url = `${agentUrl.replace(/\/$/, '')}/.well-known/wyrd.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch WYRD card from ${url}: ${res.status}`);

    const card = await res.json() as any;
    const wyrdCard: WyrdCard = {
      id: card.id,
      name: card.name,
      endpoint: card.endpoint ?? card.transport?.websocket,
      url: card.url ?? agentUrl,
      capabilities: card.capabilities ?? card.skills ?? [],
    };

    this.wyrdCardCache.set(agentUrl, wyrdCard);
    return wyrdCard;
  }

  // ── P2P: Direct Task (HTTP) ────────────────────────────────────────────────

  /**
   * Send a task directly to an agent via HTTP — no registry, no WebSocket.
   * The simplest way to call any WYRD agent if you know its URL.
   *
   * @param agentUrl - The agent's HTTP base URL
   * @param capabilityId - Which capability to invoke
   * @param input - Task input data
   */
  async directTask<T = unknown>(
    agentUrl: string,
    capabilityId: string,
    input: unknown,
  ): Promise<{ taskId: string; output: T; metrics?: { durationMs: number }; agent: { id: string; name: string } }> {
    const baseUrl = agentUrl.replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/v1/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capabilityId, input }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as any;
      throw new Error(`Task failed: ${err.error ?? res.statusText}`);
    }

    const result = await res.json() as any;
    if (result.status === 'error') {
      throw new Error(result.error?.message ?? 'Task failed');
    }

    return {
      taskId: result.taskId,
      output: result.output as T,
      metrics: result.metrics,
      agent: result.agent,
    };
  }

  // ── Registry-based Task (WebSocket) ────────────────────────────────────────

  /** Send a task to an agent (by ID via registry) and wait for the result */
  async task<T = unknown>(
    agentId: string,
    capabilityId: string,
    input: unknown,
    options?: {
      timeout?: number;
      priority?: 'low' | 'normal' | 'high';
      budget?: number;
    },
  ): Promise<{ taskId: string; output: T; metrics?: { durationMs: number } }> {
    await this.init();

    const taskId = ulid();
    const endpoint = await this.getAgentEndpoint(agentId);

    await this.transport.connect(endpoint, agentId);

    const msg = await this.createMessage(agentId, 'task.request', {
      type: 'task.request',
      taskId,
      capabilityId,
      input,
      constraints: {
        maxDurationMs: options?.timeout,
        budget: options?.budget,
        priority: options?.priority ?? 'normal',
      },
    });

    await this.transport.send(agentId, msg);

    return new Promise<{ taskId: string; output: T; metrics?: { durationMs: number } }>(
      (resolve, reject) => {
        const timer = options?.timeout
          ? setTimeout(() => {
              this.pendingTasks.delete(taskId);
              reject(new Error(`Task ${taskId} timed out after ${options.timeout}ms`));
            }, options.timeout)
          : undefined;

        this.pendingTasks.set(taskId, {
          resolve: (result: TaskResultBody) => {
            if (timer) clearTimeout(timer);
            this.pendingTasks.delete(taskId);
            if (result.status === 'success') {
              resolve({ taskId, output: result.output as T, metrics: result.metrics });
            } else {
              reject(new Error(result.error?.message ?? `Task failed: ${result.status}`));
            }
          },
          reject: (err) => {
            if (timer) clearTimeout(timer);
            this.pendingTasks.delete(taskId);
            reject(err);
          },
        });
      },
    );
  }

  /** Send a task and stream progress updates */
  async *taskStream(
    agentId: string,
    capabilityId: string,
    input: unknown,
  ): AsyncGenerator<TaskStreamEvent> {
    await this.init();

    const taskId = ulid();
    const endpoint = await this.getAgentEndpoint(agentId);
    await this.transport.connect(endpoint, agentId);

    const msg = await this.createMessage(agentId, 'task.request', {
      type: 'task.request',
      taskId,
      capabilityId,
      input,
    });

    await this.transport.send(agentId, msg);

    const events: TaskStreamEvent[] = [];
    let done = false;
    let resolver: (() => void) | null = null;

    this.pendingTasks.set(taskId, {
      resolve: () => { done = true; if (resolver) resolver(); },
      reject: () => { done = true; if (resolver) resolver(); },
      onProgress: (event) => { events.push(event); if (resolver) resolver(); },
    });

    try {
      while (!done) {
        if (events.length > 0) {
          yield events.shift()!;
        } else {
          await new Promise<void>((r) => { resolver = r; });
          resolver = null;
        }
      }
      while (events.length > 0) yield events.shift()!;
    } finally {
      this.pendingTasks.delete(taskId);
    }
  }

  /** Rate an agent after task completion */
  async rate(
    agentId: string,
    taskId: string,
    rating: { rating: 1 | 2 | 3 | 4 | 5; dimensions?: { accuracy?: number; speed?: number; reliability?: number }; comment?: string },
  ): Promise<void> {
    if (!this.config.registry) throw new Error('No registry configured for rating');
    await this.init();

    const response = await fetch(`${this.config.registry}/v1/reputation/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Id': this.identity.id, 'X-Timestamp': Date.now().toString() },
      body: JSON.stringify({ taskId, subjectAgentId: agentId, reporterAgentId: this.identity.id, ...rating }),
    });

    if (!response.ok) throw new Error(`Rating failed: ${response.status}`);
  }

  /** Close all connections */
  async close(): Promise<void> {
    await this.transport.close();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async getAgentEndpoint(agentId: string): Promise<string> {
    if (!this.config.registry) throw new Error('No registry configured. Use directTask() for P2P.');
    const response = await fetch(`${this.config.registry}/v1/agents/${agentId}`);
    if (!response.ok) throw new Error(`Agent ${agentId} not found in registry`);
    const data = (await response.json()) as { endpoint: string };
    return data.endpoint;
  }

  private handleMessage(msg: MessageEnvelope): void {
    const body = msg.body as any;
    if (!body?.taskId) return;

    const pending = this.pendingTasks.get(body.taskId);
    if (!pending) return;

    switch (msg.type) {
      case 'task.accept':
        pending.onProgress?.({ type: 'accepted', taskId: body.taskId });
        break;
      case 'task.progress':
        pending.onProgress?.({ type: 'progress', taskId: body.taskId, progress: body.progress, status: body.status, partialResult: body.partialResult });
        break;
      case 'task.result':
        pending.onProgress?.({ type: 'result', taskId: body.taskId, output: body.output, error: body.error, metrics: body.metrics });
        pending.resolve(body);
        break;
      case 'task.reject':
        pending.reject(new Error(`Task rejected: ${body.reason} — ${body.message ?? ''}`));
        break;
    }
  }

  private async createMessage(to: string, type: MessageEnvelope['type'], body: unknown): Promise<MessageEnvelope> {
    return signMessage(this.identity, {
      v: PROTOCOL_VERSION as 1, type, id: ulid(), from: this.identity.id, to, ts: Date.now(), body,
    });
  }
}
