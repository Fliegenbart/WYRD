import { z } from 'zod';

export const PricingSchema = z.object({
  model: z.enum(['free', 'per-task', 'subscription']),
  amount: z.number().optional(),
  currency: z.string().optional(),
});

export type Pricing = z.infer<typeof PricingSchema>;

export const SlaSchema = z.object({
  maxResponseMs: z.number().int().optional(),
  availability: z.number().min(0).max(1).optional(),
});

export type Sla = z.infer<typeof SlaSchema>;

/** JSON Schema represented as a plain object */
export type JSONSchema = Record<string, unknown>;

export const CapabilitySchema = z.object({
  /** Unique capability identifier, e.g. "search-flights" */
  id: z.string(),
  /** Human-readable name */
  name: z.string(),
  /** Description of what this capability does */
  description: z.string(),
  /** JSON Schema for accepted input */
  inputSchema: z.record(z.unknown()),
  /** JSON Schema for output */
  outputSchema: z.record(z.unknown()),
  /** Searchable tags */
  tags: z.array(z.string()),
  /** Pricing model */
  pricing: PricingSchema.optional(),
  /** Service level agreement */
  sla: SlaSchema.optional(),
});

export type Capability = z.infer<typeof CapabilitySchema>;
