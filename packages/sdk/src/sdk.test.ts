import { describe, it, expect, afterEach } from 'vitest';
import { z } from 'zod';
import { Agent, defineCapability } from './index.js';
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
    // JSON Schema should have "type": "object" and "properties"
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

  it('handles a task via WebSocket and returns result', async () => {
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

    const agent = new Agent({
      name: 'EchoAgent',
      capabilities: [echo],
      port: 9881,
    });
    agents.push(agent);
    await agent.start();

    // Connect as a client and send a task
    const { WebSocketTransport } = await import('@agentnet/transport');
    const { generateIdentity, signMessage } = await import('@agentnet/identity');
    const { PROTOCOL_VERSION } = await import('@agentnet/protocol');
    const { ulid } = await import('ulid');

    const clientIdentity = await generateIdentity();
    const clientTransport = new WebSocketTransport();

    await clientTransport.connect('ws://localhost:9881', agent.id);

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
        input: { message: 'hello agentnet' },
      },
    });

    await clientTransport.send(agent.id, msg);

    // Wait for response
    await new Promise((r) => setTimeout(r, 500));
    await clientTransport.close();

    // Should have received accept + progress + result
    const resultMsg = results.find((m) => m.type === 'task.result');
    expect(resultMsg).toBeTruthy();
    expect(resultMsg.body.status).toBe('success');
    expect(resultMsg.body.output).toEqual({ reply: 'Echo: hello agentnet' });
  });

  it('rejects tasks for unknown capabilities', async () => {
    const agent = new Agent({
      name: 'EmptyAgent',
      capabilities: [],
      port: 9882,
    });
    agents.push(agent);
    await agent.start();

    const { WebSocketTransport } = await import('@agentnet/transport');
    const { generateIdentity, signMessage } = await import('@agentnet/identity');
    const { PROTOCOL_VERSION } = await import('@agentnet/protocol');
    const { ulid } = await import('ulid');

    const clientIdentity = await generateIdentity();
    const clientTransport = new WebSocketTransport();
    await clientTransport.connect('ws://localhost:9882', agent.id);

    const results: any[] = [];
    clientTransport.onMessage((msg) => results.push(msg));

    const msg = await signMessage(clientIdentity, {
      v: PROTOCOL_VERSION as 1,
      type: 'task.request',
      id: ulid(),
      from: clientIdentity.id,
      to: agent.id,
      ts: Date.now(),
      body: {
        type: 'task.request',
        taskId: ulid(),
        capabilityId: 'nonexistent',
        input: {},
      },
    });

    await clientTransport.send(agent.id, msg);
    await new Promise((r) => setTimeout(r, 300));
    await clientTransport.close();

    const rejectMsg = results.find((m) => m.type === 'task.reject');
    expect(rejectMsg).toBeTruthy();
    expect(rejectMsg.body.reason).toBe('unsupported');
  });
});
