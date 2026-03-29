import { z } from 'zod';

export const MessageTypeSchema = z.enum([
  'announce',
  'discover',
  'discover.result',
  'task.request',
  'task.accept',
  'task.reject',
  'task.progress',
  'task.result',
  'task.cancel',
  'reputation.report',
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageEnvelopeSchema = z.object({
  /** Protocol version */
  v: z.literal(1),
  /** Message type discriminator */
  type: MessageTypeSchema,
  /** Unique message ID (ULID) */
  id: z.string(),
  /** Sender agent ID (base58-encoded Ed25519 public key) */
  from: z.string(),
  /** Recipient agent ID (or "registry" for registry-bound messages) */
  to: z.string(),
  /** Unix timestamp ms */
  ts: z.number().int(),
  /** Ed25519 signature over canonical JSON of the body */
  sig: z.string(),
  /** Correlation ID linking to a prior message */
  re: z.string().optional(),
  /** Message body — type-specific payload */
  body: z.unknown(),
});

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;
