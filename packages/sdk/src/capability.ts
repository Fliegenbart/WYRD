import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Capability } from '@wyrd/protocol';
import type { CapabilityDefinition, CapabilityHandler } from './types.js';

export interface DefineCapabilityOptions<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  id: string;
  name: string;
  description: string;
  tags: string[];
  input: TInput;
  output: TOutput;
  handler: CapabilityHandler<TInput, TOutput>;
  pricing?: Capability['pricing'];
  sla?: Capability['sla'];
}

/**
 * Define a capability with Zod schemas for type-safe input/output validation.
 * The Zod schemas are automatically converted to JSON Schema for the wire protocol.
 */
export function defineCapability<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(options: DefineCapabilityOptions<TInput, TOutput>): CapabilityDefinition<TInput, TOutput> {
  return {
    id: options.id,
    name: options.name,
    description: options.description,
    tags: options.tags,
    input: options.input,
    output: options.output,
    handler: options.handler,
    pricing: options.pricing,
    sla: options.sla,
  };
}

/** Convert a CapabilityDefinition to a wire-format Capability (JSON Schema) */
export function toWireCapability(def: CapabilityDefinition): Capability {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    tags: def.tags,
    inputSchema: zodToJsonSchema(def.input, { target: 'jsonSchema7' }) as Record<string, unknown>,
    outputSchema: zodToJsonSchema(def.output, { target: 'jsonSchema7' }) as Record<string, unknown>,
    pricing: def.pricing,
    sla: def.sla,
  };
}
