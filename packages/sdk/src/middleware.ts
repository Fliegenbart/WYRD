/**
 * WYRD Middleware — Add WYRD to any existing HTTP server in 5 lines.
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { wyrdMiddleware } from '@wyrd/sdk';
 *
 * const app = new Hono();
 * app.route('/', wyrdMiddleware({
 *   name: 'MyAgent',
 *   url: 'https://my-agent.example.com',
 *   capabilities: [myCapability],
 * }));
 *
 * // Your agent now serves:
 * //   GET  /.well-known/wyrd.json  — identity card
 * //   POST /v1/task               — receive tasks
 * //   GET  /v1/capabilities       — list capabilities
 * //   GET  /health                — health check
 * ```
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ulid } from 'ulid';
import { generateIdentity, loadIdentity, type AgentIdentity } from '@wyrd/identity';
import type { CapabilityDefinition, TaskContext, TaskLogger } from './types.js';
import { toWireCapability } from './capability.js';

export interface WyrdMiddlewareConfig {
  /** Agent name */
  name: string;
  /** Agent description */
  description?: string;
  /** Public URL where this agent is reachable (e.g. "https://my-agent.fly.dev") */
  url: string;
  /** Capabilities this agent provides */
  capabilities: CapabilityDefinition<any, any>[];
  /** Pre-loaded identity */
  identity?: AgentIdentity;
  /** Private key hex (alternative to identity) */
  privateKey?: string;
  /** Handler timeout in ms (default: 30000) */
  taskTimeout?: number;
  /** Max concurrent tasks (default: 50) */
  maxConcurrentTasks?: number;
}

/**
 * Create a Hono sub-app that adds WYRD protocol support.
 * Mount it on any existing Hono/Express/Fastify server.
 */
export function wyrdMiddleware(config: WyrdMiddlewareConfig): Hono {
  const app = new Hono();
  app.use('*', cors());

  const capabilities = new Map<string, CapabilityDefinition>();
  for (const cap of config.capabilities) {
    capabilities.set(cap.id, cap);
  }

  const activeTasks = new Map<string, AbortController>();
  const taskTimeout = config.taskTimeout ?? 30_000;
  const maxConcurrent = config.maxConcurrentTasks ?? 50;

  let identity: AgentIdentity | null = null;

  const ensureIdentity = async (): Promise<AgentIdentity> => {
    if (identity) return identity;
    if (config.identity) { identity = config.identity; return identity; }
    if (config.privateKey) { identity = await loadIdentity(config.privateKey); return identity; }
    identity = await generateIdentity();
    return identity;
  };

  // ── /.well-known/wyrd.json ─────────────────────────────────────────────

  app.get('/.well-known/wyrd.json', async (c) => {
    const id = await ensureIdentity();
    const wireCaps = config.capabilities.map(toWireCapability);

    return c.json({
      wyrd: '1.0',
      id: id.id,
      name: config.name,
      description: config.description ?? '',
      url: config.url,
      publicKey: id.id,
      capabilities: wireCaps,
      transport: {
        http: `${config.url}/v1/task`,
      },
      provider: {
        protocol: 'wyrd/v1',
      },
    });
  });

  // ── Health ─────────────────────────────────────────────────────────────

  app.get('/health', async (c) => {
    const id = await ensureIdentity();
    return c.json({
      status: 'ok',
      agent: config.name,
      id: id.id,
      activeTasks: activeTasks.size,
      capabilities: config.capabilities.length,
    });
  });

  // ── Capabilities ───────────────────────────────────────────────────────

  app.get('/v1/capabilities', (c) => {
    return c.json({
      capabilities: config.capabilities.map(toWireCapability),
    });
  });

  // ── Task Endpoint ──────────────────────────────────────────────────────

  app.post('/v1/task', async (c) => {
    const id = await ensureIdentity();

    // Rate limit: max concurrent tasks
    if (activeTasks.size >= maxConcurrent) {
      return c.json({ error: 'Too many concurrent tasks', limit: maxConcurrent }, 429);
    }

    const body = await c.req.json();
    const { capabilityId, input, taskId: providedTaskId } = body;

    const capability = capabilities.get(capabilityId);
    if (!capability) {
      return c.json({ error: 'Unknown capability', capabilityId, available: Array.from(capabilities.keys()) }, 404);
    }

    const inputResult = capability.input.safeParse(input);
    if (!inputResult.success) {
      return c.json({ error: 'Invalid input', details: inputResult.error.issues }, 400);
    }

    const taskId = providedTaskId ?? ulid();
    const controller = new AbortController();
    activeTasks.set(taskId, controller);

    // Handler timeout
    const timer = setTimeout(() => {
      controller.abort();
    }, taskTimeout);

    const progressUpdates: Array<{ percent: number; status: string }> = [];

    const log: TaskLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    const ctx: TaskContext = {
      taskId,
      requesterId: body.agentId ?? 'http-client',
      capabilityId,
      progress: (percent, status) => { progressUpdates.push({ percent, status }); },
      delegate: async () => { throw new Error('Delegation requires AgentClient'); },
      signal: controller.signal,
      log,
    };

    const startTime = Date.now();
    try {
      const output = await capability.handler(inputResult.data, ctx);
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      return c.json({
        taskId,
        status: 'success',
        output,
        metrics: { durationMs },
        progress: progressUpdates,
        agent: { id: id.id, name: config.name },
      });
    } catch (err) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const error = err instanceof Error ? err : new Error(String(err));
      const isTimeout = controller.signal.aborted;

      return c.json({
        taskId,
        status: 'error',
        error: {
          code: isTimeout ? 'TIMEOUT' : 'HANDLER_ERROR',
          message: isTimeout ? `Task timed out after ${taskTimeout}ms` : error.message,
        },
        metrics: { durationMs },
      }, isTimeout ? 408 : 500);
    } finally {
      activeTasks.delete(taskId);
    }
  });

  return app;
}
