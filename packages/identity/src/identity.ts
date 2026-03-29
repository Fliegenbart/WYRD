import * as ed from '@noble/ed25519';
import { encode, decode } from './base58.js';

export interface AgentIdentity {
  /** Base58-encoded public key (= agent ID) */
  id: string;
  /** Raw 32-byte public key */
  publicKey: Uint8Array;
  /** Sign arbitrary data */
  sign(data: Uint8Array): Promise<Uint8Array>;
  /** Export private key as hex string */
  exportPrivateKey(): string;
}

/** Generate a brand new agent identity */
export async function generateIdentity(): Promise<AgentIdentity> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return createIdentity(privateKey, publicKey);
}

/** Load identity from a hex-encoded private key string */
export async function loadIdentity(privateKeyHex: string): Promise<AgentIdentity> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return createIdentity(privateKey, publicKey);
}

/** Load identity from WYRD_PRIVATE_KEY environment variable */
export async function loadIdentityFromEnv(): Promise<AgentIdentity> {
  const key = process.env['WYRD_PRIVATE_KEY'];
  if (!key) {
    throw new Error(
      'WYRD_PRIVATE_KEY environment variable not set. ' +
        'Generate one with: npx create-wyrd',
    );
  }
  return loadIdentity(key);
}

/** Verify a signature against a public key (agent ID) */
export async function verifySignature(
  agentId: string,
  data: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const publicKey = decode(agentId);
  return ed.verifyAsync(signature, data, publicKey);
}

/** Get the agent ID (base58 public key) from a private key */
export async function agentIdFromPrivateKey(privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return encode(publicKey);
}

function createIdentity(privateKey: Uint8Array, publicKey: Uint8Array): AgentIdentity {
  const id = encode(publicKey);
  return {
    id,
    publicKey,
    async sign(data: Uint8Array): Promise<Uint8Array> {
      return ed.signAsync(data, privateKey);
    },
    exportPrivateKey(): string {
      return bytesToHex(privateKey);
    },
  };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
