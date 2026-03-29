import type { MessageEnvelope } from '@agentnet/protocol';
import type { AgentIdentity } from './identity.js';
import { verifySignature } from './identity.js';

/** Canonicalize a message for signing: deterministic JSON of all fields except `sig` */
function canonicalize(message: Omit<MessageEnvelope, 'sig'>): Uint8Array {
  const ordered = JSON.stringify(message, Object.keys(message).filter((k) => k !== 'sig').sort());
  return new TextEncoder().encode(ordered);
}

/** Sign a protocol message — fills in the `sig` field */
export async function signMessage(
  identity: AgentIdentity,
  message: Omit<MessageEnvelope, 'sig'>,
): Promise<MessageEnvelope> {
  const data = canonicalize(message);
  const signature = await identity.sign(data);
  return {
    ...message,
    sig: bytesToBase64(signature),
  } as MessageEnvelope;
}

/** Verify a signed protocol message */
export async function verifyMessage(message: MessageEnvelope): Promise<boolean> {
  const { sig, ...rest } = message;
  const data = canonicalize(rest);
  const signature = base64ToBytes(sig);
  return verifySignature(message.from, data, signature);
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'));
}
