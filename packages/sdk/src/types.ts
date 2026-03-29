import type { z } from 'zod';
import type { Capability, Pricing, Sla } from '@agentnet/protocol';
import type { AgentIdentity } from '@agentnet/identity';

export interface AgentConfig {
  /** Human-readable agent name */
  name: string;
  /** Agent description */
  description?: string;
  /** Capabilities this agent provides */
  capabilities: CapabilityDefinition<any, any>[];
  /** Registry URL to announce to */
  registry?: string;
  /** WebSocket listen port (default: auto-assigned) */
  port?: number;
  /** Pre-loaded identity (auto-generated if not provided) */
  identity?: AgentIdentity;
  /** Private key hex (alternative to identity) */
  privateKey?: string;
}

export interface CapabilityDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  /** Unique capability ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Searchable tags */
  tags: string[];
  /** Zod schema for input validation */
  input: TInput;
  /** Zod schema for output validation */
  output: TOutput;
  /** Handler function */
  handler: CapabilityHandler<TInput, TOutput>;
  /** Pricing info */
  pricing?: Pricing;
  /** SLA info */
  sla?: Sla;
}

export type CapabilityHandler<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = (input: z.infer<TInput>, ctx: TaskContext) => Promise<z.infer<TOutput>>;

export interface TaskContext {
  /** Unique task ID */
  taskId: string;
  /** ID of the agent that requested this task */
  requesterId: string;
  /** Which capability was invoked */
  capabilityId: string;
  /** Report progress to the requester (0-100) */
  progress(percent: number, status: string, partialResult?: unknown): void;
  /** Delegate a sub-task to another agent */
  delegate<T = unknown>(
    agentId: string,
    capabilityId: string,
    input: unknown,
  ): Promise<T>;
  /** Abort signal — set if task is cancelled */
  signal: AbortSignal;
  /** Logger scoped to this task */
  log: TaskLogger;
}

export interface TaskLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface DiscoverOptions {
  /** Match any of these tags */
  tags?: string[];
  /** Free-text search */
  text?: string;
  /** Exact capability ID match */
  capabilityId?: string;
  /** Minimum reputation score (0-100) */
  minReputation?: number;
  /** Max price per task */
  maxPricePerTask?: number;
  /** Max results */
  limit?: number;
}

export interface DiscoveredAgent {
  agentId: string;
  name?: string;
  description?: string;
  capabilities: Capability[];
  reputation: {
    overall: number;
    totalTasks: number;
    confidenceLevel: 'low' | 'medium' | 'high';
  };
  endpoint: string;
}

export interface TaskStreamEvent {
  type: 'accepted' | 'progress' | 'result';
  taskId: string;
  progress?: number;
  status?: string;
  partialResult?: unknown;
  output?: unknown;
  error?: { code: string; message: string };
  metrics?: { durationMs: number; tokensUsed?: number };
}
