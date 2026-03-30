/**
 * WYRD Middleware Integration
 *
 * Add WYRD to any existing Hono server in 5 lines.
 * Your existing routes keep working — WYRD just adds
 * /.well-known/wyrd.json and /v1/task alongside them.
 *
 * Run: npx tsx examples/middleware-integration/server.ts
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { wyrdMiddleware, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

// ── Your existing app ────────────────────────────────────

const app = new Hono();

// Your existing routes — these keep working unchanged
app.get('/', (c) => c.json({ message: 'My existing API' }));
app.get('/api/data', (c) => c.json({ data: [1, 2, 3] }));

// ── Add WYRD in 5 lines ─────────────────────────────────

const calculator = defineCapability({
  id: 'calculate',
  name: 'Calculator',
  description: 'Basic math operations',
  tags: ['math', 'calculator'],
  input: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  output: z.object({ result: z.number() }),
  handler: async (input) => {
    const ops = { add: input.a + input.b, subtract: input.a - input.b, multiply: input.a * input.b, divide: input.a / input.b };
    return { result: ops[input.operation] };
  },
});

// Mount WYRD alongside your existing routes
app.route('/', wyrdMiddleware({
  name: 'CalculatorAgent',
  url: 'http://localhost:4301',
  capabilities: [calculator],
}));

// ── Start ────────────────────────────────────────────────

serve({ fetch: app.fetch, port: 4301 }, () => {
  console.log(`
  Server running on http://localhost:4301

  Existing routes (unchanged):
    GET  /            → your API
    GET  /api/data    → your data

  WYRD routes (added by middleware):
    GET  /.well-known/wyrd.json  → agent identity card
    POST /v1/task               → receive tasks
    GET  /v1/capabilities       → list capabilities
    GET  /health                → health check

  Try it:
    curl http://localhost:4301/.well-known/wyrd.json
    curl -X POST http://localhost:4301/v1/task \\
      -H "Content-Type: application/json" \\
      -d '{"capabilityId":"calculate","input":{"operation":"add","a":40,"b":2}}'
`);
});
