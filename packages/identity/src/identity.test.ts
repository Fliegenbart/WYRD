import { describe, it, expect } from 'vitest';
import {
  generateIdentity,
  loadIdentity,
  verifySignature,
} from './identity.js';
import { signMessage, verifyMessage } from './signing.js';
import type { MessageEnvelope } from '@agentnet/protocol';

describe('Identity', () => {
  it('generates a new identity with a valid ID', async () => {
    const identity = await generateIdentity();
    expect(identity.id).toBeTruthy();
    expect(identity.publicKey).toHaveLength(32);
    expect(typeof identity.exportPrivateKey()).toBe('string');
  });

  it('round-trips through export/load', async () => {
    const identity = await generateIdentity();
    const exported = identity.exportPrivateKey();
    const restored = await loadIdentity(exported);
    expect(restored.id).toBe(identity.id);
  });

  it('signs and verifies data', async () => {
    const identity = await generateIdentity();
    const data = new TextEncoder().encode('hello agentnet');
    const signature = await identity.sign(data);
    const valid = await verifySignature(identity.id, data, signature);
    expect(valid).toBe(true);
  });

  it('rejects tampered data', async () => {
    const identity = await generateIdentity();
    const data = new TextEncoder().encode('hello agentnet');
    const signature = await identity.sign(data);
    const tampered = new TextEncoder().encode('hello hacker');
    const valid = await verifySignature(identity.id, tampered, signature);
    expect(valid).toBe(false);
  });

  it('rejects signature from wrong agent', async () => {
    const alice = await generateIdentity();
    const bob = await generateIdentity();
    const data = new TextEncoder().encode('hello');
    const signature = await alice.sign(data);
    const valid = await verifySignature(bob.id, data, signature);
    expect(valid).toBe(false);
  });
});

describe('Message Signing', () => {
  it('signs and verifies a protocol message', async () => {
    const identity = await generateIdentity();
    const unsigned: Omit<MessageEnvelope, 'sig'> = {
      v: 1,
      type: 'announce',
      id: 'test-msg-001',
      from: identity.id,
      to: 'registry',
      ts: Date.now(),
      body: {
        type: 'announce',
        capabilities: [],
        endpoint: 'ws://localhost:4201',
      },
    };

    const signed = await signMessage(identity, unsigned);
    expect(signed.sig).toBeTruthy();

    const valid = await verifyMessage(signed);
    expect(valid).toBe(true);
  });

  it('rejects a tampered message', async () => {
    const identity = await generateIdentity();
    const unsigned: Omit<MessageEnvelope, 'sig'> = {
      v: 1,
      type: 'announce',
      id: 'test-msg-002',
      from: identity.id,
      to: 'registry',
      ts: Date.now(),
      body: { type: 'announce', capabilities: [], endpoint: 'ws://localhost:4201' },
    };

    const signed = await signMessage(identity, unsigned);
    // Tamper with the message
    const tampered = { ...signed, ts: signed.ts + 1 };
    const valid = await verifyMessage(tampered);
    expect(valid).toBe(false);
  });
});
