import { describe, it, expect, afterEach } from 'vitest';
import { WebSocketTransport } from './ws-transport.js';
import type { MessageEnvelope } from '@wyrd/protocol';

function makeMessage(from: string, to: string): MessageEnvelope {
  return {
    v: 1,
    type: 'task.request',
    id: `msg-${Date.now()}`,
    from,
    to,
    ts: Date.now(),
    sig: 'test-sig',
    body: {
      type: 'task.request',
      taskId: 'task-001',
      capabilityId: 'test',
      input: { hello: 'world' },
    },
  };
}

describe('WebSocketTransport', () => {
  const transports: WebSocketTransport[] = [];

  function createTransport(opts = {}) {
    const t = new WebSocketTransport(opts);
    transports.push(t);
    return t;
  }

  afterEach(async () => {
    for (const t of transports) {
      await t.close();
    }
    transports.length = 0;
  });

  it('starts a server and accepts connections', async () => {
    const server = createTransport();
    await server.listen(0); // random port

    // Get the assigned port
    const address = (server as any).server?.address();
    expect(address).toBeTruthy();
    expect(address.port).toBeGreaterThan(0);
  });

  it('sends and receives messages between two transports', async () => {
    const server = createTransport();
    await server.listen(9871);

    const client = createTransport();
    await client.connect('ws://localhost:9871', 'server-agent');

    const received: MessageEnvelope[] = [];
    server.onMessage((msg) => received.push(msg));

    const msg = makeMessage('client-agent', 'server-agent');
    await client.send('server-agent', msg);

    // Wait for message to arrive
    await new Promise((r) => setTimeout(r, 100));

    expect(received).toHaveLength(1);
    expect(received[0].body).toEqual(msg.body);
  });

  it('tracks connected peers', async () => {
    const server = createTransport();
    await server.listen(9872);

    const client = createTransport();
    await client.connect('ws://localhost:9872', 'peer-1');

    expect(client.connectedPeers).toContain('peer-1');
    expect(client.peerCount).toBe(1);

    await client.disconnect('peer-1');
    expect(client.peerCount).toBe(0);
  });

  it('emits connected/disconnected events', async () => {
    const server = createTransport();
    await server.listen(9873);

    const events: string[] = [];
    const client = createTransport();
    client.on('connected', (id) => events.push(`connected:${id}`));
    client.on('disconnected', (id) => events.push(`disconnected:${id}`));

    await client.connect('ws://localhost:9873', 'event-peer');
    expect(events).toContain('connected:event-peer');

    await client.disconnect('event-peer');
    // disconnected fires asynchronously
    await new Promise((r) => setTimeout(r, 100));
    expect(events).toContain('disconnected:event-peer');
  });
});
