import { ulid } from 'ulid';
import type { MessageEnvelope, TaskResultBody, TaskProgressBody } from '@wyrd/protocol';
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
  /** Registry URL */
  registry: string;
  /** Pre-loaded identity (auto-generated if not provided) */
  identity?: AgentIdentity;
  /** Private key hex */
  privateKey?: string;
}

export class AgentClient {
  private config: AgentClientConfig;
  private identity!: AgentIdentity;
  private transport: WebSocketTransport;
  private initialized = false;
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

  /** Discover agents matching the given criteria */
  async discover(options: DiscoverOptions = {}): Promise<DiscoveredAgent[]> {
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

  /** Send a task to an agent and wait for the result */
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

    // Get agent endpoint from registry
    const endpoint = await this.getAgentEndpoint(agentId);

    // Connect to the agent
    await this.transport.connect(endpoint, agentId);

    // Create and send task request
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

    // Wait for result
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
              resolve({
                taskId,
                output: result.output as T,
                metrics: result.metrics,
              });
            } else {
              reject(
                new Error(
                  result.error?.message ?? `Task failed with status: ${result.status}`,
                ),
              );
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

    // Yield events as they come in
    const events: TaskStreamEvent[] = [];
    let done = false;
    let resolver: (() => void) | null = null;

    this.pendingTasks.set(taskId, {
      resolve: () => {
        done = true;
        if (resolver) resolver();
      },
      reject: () => {
        done = true;
        if (resolver) resolver();
      },
      onProgress: (event) => {
        events.push(event);
        if (resolver) resolver();
      },
    });

    try {
      while (!done) {
        if (events.length > 0) {
          yield events.shift()!;
        } else {
          await new Promise<void>((r) => {
            resolver = r;
          });
          resolver = null;
        }
      }

      // Yield remaining events
      while (events.length > 0) {
        yield events.shift()!;
      }
    } finally {
      this.pendingTasks.delete(taskId);
    }
  }

  /** Rate an agent after task completion */
  async rate(
    agentId: string,
    taskId: string,
    rating: {
      rating: 1 | 2 | 3 | 4 | 5;
      dimensions?: { accuracy?: number; speed?: number; reliability?: number };
      comment?: string;
    },
  ): Promise<void> {
    await this.init();

    const response = await fetch(`${this.config.registry}/v1/reputation/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': this.identity.id,
        'X-Timestamp': Date.now().toString(),
      },
      body: JSON.stringify({
        taskId,
        subjectAgentId: agentId,
        reporterAgentId: this.identity.id,
        ...rating,
      }),
    });

    if (!response.ok) {
      throw new Error(`Rating failed: ${response.status}`);
    }
  }

  /** Close all connections */
  async close(): Promise<void> {
    await this.transport.close();
  }

  private async getAgentEndpoint(agentId: string): Promise<string> {
    const response = await fetch(`${this.config.registry}/v1/agents/${agentId}`);
    if (!response.ok) {
      throw new Error(`Agent ${agentId} not found in registry`);
    }
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
        pending.onProgress?.({
          type: 'accepted',
          taskId: body.taskId,
        });
        break;
      case 'task.progress':
        pending.onProgress?.({
          type: 'progress',
          taskId: body.taskId,
          progress: body.progress,
          status: body.status,
          partialResult: body.partialResult,
        });
        break;
      case 'task.result':
        pending.onProgress?.({
          type: 'result',
          taskId: body.taskId,
          output: body.output,
          error: body.error,
          metrics: body.metrics,
        });
        pending.resolve(body);
        break;
      case 'task.reject':
        pending.reject(new Error(`Task rejected: ${body.reason} — ${body.message ?? ''}`));
        break;
    }
  }

  private async createMessage(
    to: string,
    type: MessageEnvelope['type'],
    body: unknown,
  ): Promise<MessageEnvelope> {
    const unsigned = {
      v: PROTOCOL_VERSION as 1,
      type,
      id: ulid(),
      from: this.identity.id,
      to,
      ts: Date.now(),
      body,
    };
    return signMessage(this.identity, unsigned);
  }
}
