/**
 * WYRD — Standalone Implementation (NO SDK required)
 *
 * This example shows how to make any HTTP server a WYRD agent
 * using only standard Node.js. No @wyrd/sdk, no dependencies.
 *
 * This proves WYRD is a protocol, not a library.
 *
 * Run: npx tsx examples/standalone-card/server.ts
 * Test: curl http://localhost:4300/.well-known/wyrd.json
 * Task: curl -X POST http://localhost:4300/v1/task \
 *         -H "Content-Type: application/json" \
 *         -d '{"capabilityId":"echo","input":{"message":"hello"}}'
 */

import { createServer } from 'node:http';

const PORT = 4300;

// The WYRD Card — your agent's identity
const wyrdCard = {
  wyrd: '1.0',
  id: 'standalone-agent-001',
  name: 'StandaloneEcho',
  description: 'A WYRD agent built without the SDK — just HTTP',
  url: `http://localhost:${PORT}`,
  capabilities: [
    {
      id: 'echo',
      name: 'Echo',
      description: 'Echoes back whatever you send',
      tags: ['echo', 'test'],
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
      outputSchema: {
        type: 'object',
        properties: { reply: { type: 'string' }, timestamp: { type: 'string' } },
      },
    },
  ],
  transport: {
    http: `http://localhost:${PORT}/v1/task`,
  },
};

// Capability handlers
const handlers: Record<string, (input: any) => any> = {
  echo: (input) => ({
    reply: `Echo: ${input.message}`,
    timestamp: new Date().toISOString(),
  }),
};

// Plain Node.js HTTP server — no frameworks, no dependencies
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // /.well-known/wyrd.json — agent identity card
  if (url.pathname === '/.well-known/wyrd.json' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(wyrdCard, null, 2));
    return;
  }

  // /v1/task — receive tasks
  if (url.pathname === '/v1/task' && req.method === 'POST') {
    const body = await readBody(req);
    const { capabilityId, input } = JSON.parse(body);

    const handler = handlers[capabilityId];
    if (!handler) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Unknown capability', capabilityId }));
      return;
    }

    const start = Date.now();
    try {
      const output = handler(input);
      res.writeHead(200);
      res.end(JSON.stringify({
        taskId: `task-${Date.now()}`,
        status: 'success',
        output,
        metrics: { durationMs: Date.now() - start },
        agent: { id: wyrdCard.id, name: wyrdCard.name },
      }));
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({
        taskId: `task-${Date.now()}`,
        status: 'error',
        error: { code: 'HANDLER_ERROR', message: err.message },
      }));
    }
    return;
  }

  // /health
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', agent: wyrdCard.name }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk; });
    req.on('end', () => resolve(data));
  });
}

server.listen(PORT, () => {
  console.log(`\nStandalone WYRD agent (no SDK) running on http://localhost:${PORT}`);
  console.log(`  WYRD Card: http://localhost:${PORT}/.well-known/wyrd.json`);
  console.log(`  Task:      POST http://localhost:${PORT}/v1/task`);
  console.log(`\nThis agent was built with zero WYRD dependencies.`);
  console.log(`Any WYRD client can discover and call it.\n`);
});
