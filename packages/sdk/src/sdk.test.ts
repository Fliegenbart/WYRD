import { describe, it, expect, afterEach } from 'vitest';
import { z } from 'zod';
import { Agent, AgentClient, defineCapability } from './index.js';
import { toWireCapability } from './capability.js';

describe('defineCapability', () => {
  it('creates a capability definition with Zod schemas', () => {
    const cap = defineCapability({
      id: 'test-cap',
      name: 'Test',
      description: 'A test capability',
      tags: ['test'],
      input: z.object({ message: z.string() }),
      output: z.object({ reply: z.string() }),
      handler: async (input) => ({ reply: `Echo: ${input.message}` }),
    });

    expect(cap.id).toBe('test-cap');
    expect(cap.name).toBe('Test');
    expect(cap.tags).toEqual(['test']);
  });

  it('converts to wire format with JSON Schema', () => {
    const cap = defineCapability({
      id: 'greet',
      name: 'Greeting',
      description: 'Greets someone',
      tags: ['social'],
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      handler: async (input) => ({ greeting: `Hello, ${input.name}!` }),
    });

    const wire = toWireCapability(cap);
    expect(wire.id).toBe('greet');
    expect(wire.inputSchema).toBeDefined();
    expect(wire.outputSchema).toBeDefined();
    expect(wire.inputSchema['type']).toBe('object');
    expect((wire.inputSchema['properties'] as any)?.['name']).toBeDefined();
  });
});

describe('Agent', () => {
  const agents: Agent[] = [];

  afterEach(async () => {
    for (const a of agents) {
      await a.stop();
    }
    agents.length = 0;
  });

  it('starts and generates an identity', async () => {
    const echo = defineCapability({
      id: 'echo',
      name: 'Echo',
      description: 'Echoes input',
      tags: ['test'],
      input: z.object({ message: z.string() }),
      output: z.object({ reply: z.string() }),
      handler: async (input) => ({ reply: input.message }),
    });

    const agent = new Agent({
      name: 'TestAgent',
      capabilities: [echo],
    });
    agents.push(agent);

    await agent.start();

    expect(agent.id).toBeTruthy();
    expect(agent.id.length).toBeGreaterThan(10);
    expect(agent.port).toBeGreaterThan(0);
  });

  it('serves /.well-known/wyrd.json', async () => {
    const echo = defineCapability({
      id: 'echo',
      name: 'Echo',
      description: 'Echoes input',
      tags: ['test'],
      input: z.object({ message: z.string() }),
      output: z.object({ reply: z.string() }),
      handler: async (input) => ({ reply: input.message }),
    });

    const agent = new Agent({ name: 'CardAgent', capabilities: [echo] });
    agents.push(agent);
    await agent.start();

    const res = await fetch(`http://localhost:${agent.port}/.well-known/wyrd.json`);
    expect(res.ok).toBe(true);

    const card = await res.json() as any;
    expect(card.wyrd).toBe('1.0');
    expect(card.name).toBe('CardAgent');
    expect(card.id).toBe(agent.id);
    expect(card.capabilities).toHaveLength(1);
    expect(card.capabilities[0].id).toBe('echo');
    expect(card.transport.http).toContain('/v1/task');
    expect(card.transport.websocket).toContain('ws://');
  });

  it('handles direct HTTP tasks (P2P, no registry)', async () => {
    const echo = defineCapability({
      id: 'echo',
      name: 'Echo',
      description: 'Echoes input',
      tags: ['test'],
      input: z.object({ message: z.string() }),
      output: z.object({ reply: z.string() }),
      handler: async (input, ctx) => {
        ctx.progress(50, 'Processing...');
        return { reply: `Echo: ${input.message}` };
      },
    });

    const agent = new Agent({ name: 'HttpAgent', capabilities: [echo] });
    agents.push(agent);
    await agent.start();

    // Direct P2P task via HTTP — no registry needed
    const client = new AgentClient({});
    const result = await client.directTask(
      `http://localhost:${agent.port}`,
      'echo',
      { message: 'hello wyrd' },
    );

    expect(result.output).toEqual({ reply: 'Echo: hello wyrd' });
    expect(result.agent.name).toBe('HttpAgent');
    expect(result.agent.id).toBe(agent.id);
    expect(result.metrics?.durationMs).toBeGreaterThanOrEqual(0);
    await client.close();
  });

  it('handles WebSocket tasks', async () => {
    const echo = defineCapability({
      id: 'echo',
      name: 'Echo',
      description: 'Echoes input',
      tags: ['test'],
      input: z.object({ message: z.string() }),
      output: z.object({ reply: z.string() }),
      handler: async (input, ctx) => {
        ctx.progress(50, 'Processing...');
        return { reply: `Echo: ${input.message}` };
      },
    });

    const agent = new Agent({ name: 'WsAgent', capabilities: [echo] });
    agents.push(agent);
    await agent.start();

    const { WebSocketTransport } = await import('@wyrd/transport');
    const { generateIdentity, signMessage } = await import('@wyrd/identity');
    const { PROTOCOL_VERSION } = await import('@wyrd/protocol');
    const { ulid } = await import('ulid');

    const clientIdentity = await generateIdentity();
    const clientTransport = new WebSocketTransport();

    // Connect to the WebSocket port (agent.wsPort, NOT agent.port)
    await clientTransport.connect(`ws://localhost:${agent.wsPort}`, agent.id);

    const results: any[] = [];
    clientTransport.onMessage((msg) => results.push(msg));

    const taskId = ulid();
    const msg = await signMessage(clientIdentity, {
      v: PROTOCOL_VERSION as 1,
      type: 'task.request',
      id: ulid(),
      from: clientIdentity.id,
      to: agent.id,
      ts: Date.now(),
      body: {
        type: 'task.request',
        taskId,
        capabilityId: 'echo',
        input: { message: 'hello p2p' },
      },
    });

    await clientTransport.send(agent.id, msg);
    await new Promise((r) => setTimeout(r, 500));
    await clientTransport.close();

    const resultMsg = results.find((m) => m.type === 'task.result');
    expect(resultMsg).toBeTruthy();
    expect(resultMsg.body.status).toBe('success');
    expect(resultMsg.body.output).toEqual({ reply: 'Echo: hello p2p' });
  });

  it('rejects HTTP tasks for unknown capabilities', async () => {
    const agent = new Agent({ name: 'EmptyAgent', capabilities: [] });
    agents.push(agent);
    await agent.start();

    const res = await fetch(`http://localhost:${agent.port}/v1/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capabilityId: 'nonexistent', input: {} }),
    });

    expect(res.status).toBe(404);
    const data = await res.json() as any;
    expect(data.error).toBe('Unknown capability');
  });
});
