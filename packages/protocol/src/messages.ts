import { z } from 'zod';
import { CapabilitySchema } from './capability.js';

// ── 1. ANNOUNCE ──────────────────────────────────────────────────────────────

export const AnnounceBodySchema = z.object({
  type: z.literal('announce'),
  capabilities: z.array(CapabilitySchema),
  endpoint: z.string().url(),
  meta: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      version: z.string().optional(),
      homepage: z.string().url().optional(),
      owner: z.string().optional(),
    })
    .optional(),
  ttl: z.number().int().positive().default(3600),
});

export type AnnounceBody = z.infer<typeof AnnounceBodySchema>;

// ── 2. DISCOVER ──────────────────────────────────────────────────────────────

export const DiscoverBodySchema = z.object({
  type: z.literal('discover'),
  query: z.object({
    tags: z.array(z.string()).optional(),
    text: z.string().optional(),
    capabilityId: z.string().optional(),
    minReputation: z.number().min(0).max(100).optional(),
    maxPricePerTask: z.number().optional(),
    limit: z.number().int().positive().default(10),
  }),
});

export type DiscoverBody = z.infer<typeof DiscoverBodySchema>;

// ── 3. DISCOVER.RESULT ───────────────────────────────────────────────────────

export const ReputationScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  totalTasks: z.number().int(),
  confidenceLevel: z.enum(['low', 'medium', 'high']),
});

export type ReputationScore = z.infer<typeof ReputationScoreSchema>;

export const DiscoverResultBodySchema = z.object({
  type: z.literal('discover.result'),
  agents: z.array(
    z.object({
      agentId: z.string(),
      capabilities: z.array(CapabilitySchema),
      reputation: ReputationScoreSchema,
      endpoint: z.string(),
      meta: z.record(z.string()).optional(),
    }),
  ),
  total: z.number().int(),
});

export type DiscoverResultBody = z.infer<typeof DiscoverResultBodySchema>;

// ── 4. TASK.REQUEST ──────────────────────────────────────────────────────────

export const TaskRequestBodySchema = z.object({
  type: z.literal('task.request'),
  taskId: z.string(),
  capabilityId: z.string(),
  input: z.unknown(),
  constraints: z
    .object({
      maxDurationMs: z.number().int().positive().optional(),
      budget: z.number().optional(),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
    })
    .optional(),
  context: z
    .object({
      parentTaskId: z.string().optional(),
      conversationId: z.string().optional(),
    })
    .optional(),
});

export type TaskRequestBody = z.infer<typeof TaskRequestBodySchema>;

// ── 5. TASK.ACCEPT ───────────────────────────────────────────────────────────

export const TaskAcceptBodySchema = z.object({
  type: z.literal('task.accept'),
  taskId: z.string(),
  estimatedDurationMs: z.number().int().positive().optional(),
  terms: z
    .object({
      price: z.number().optional(),
      currency: z.string().optional(),
    })
    .optional(),
});

export type TaskAcceptBody = z.infer<typeof TaskAcceptBodySchema>;

// ── 6. TASK.REJECT ───────────────────────────────────────────────────────────

export const TaskRejectBodySchema = z.object({
  type: z.literal('task.reject'),
  taskId: z.string(),
  reason: z.enum(['busy', 'unsupported', 'over-budget', 'unauthorized', 'other']),
  message: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
});

export type TaskRejectBody = z.infer<typeof TaskRejectBodySchema>;

// ── 7. TASK.PROGRESS ─────────────────────────────────────────────────────────

export const TaskProgressBodySchema = z.object({
  type: z.literal('task.progress'),
  taskId: z.string(),
  progress: z.number().min(0).max(100),
  status: z.string(),
  partialResult: z.unknown().optional(),
});

export type TaskProgressBody = z.infer<typeof TaskProgressBodySchema>;

// ── 8. TASK.RESULT ───────────────────────────────────────────────────────────

export const TaskResultBodySchema = z.object({
  type: z.literal('task.result'),
  taskId: z.string(),
  status: z.enum(['success', 'error', 'partial']),
  output: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
  metrics: z
    .object({
      durationMs: z.number().int(),
      tokensUsed: z.number().int().optional(),
    })
    .optional(),
});

export type TaskResultBody = z.infer<typeof TaskResultBodySchema>;

// ── 9. TASK.CANCEL ───────────────────────────────────────────────────────────

export const TaskCancelBodySchema = z.object({
  type: z.literal('task.cancel'),
  taskId: z.string(),
  reason: z.string().optional(),
});

export type TaskCancelBody = z.infer<typeof TaskCancelBodySchema>;

// ── 10. REPUTATION.REPORT ────────────────────────────────────────────────────

export const ReputationReportBodySchema = z.object({
  type: z.literal('reputation.report'),
  taskId: z.string(),
  subjectAgentId: z.string(),
  rating: z.number().int().min(1).max(5),
  dimensions: z
    .object({
      accuracy: z.number().int().min(1).max(5).optional(),
      speed: z.number().int().min(1).max(5).optional(),
      reliability: z.number().int().min(1).max(5).optional(),
    })
    .optional(),
  comment: z.string().optional(),
});

export type ReputationReportBody = z.infer<typeof ReputationReportBodySchema>;

// ── Union type ───────────────────────────────────────────────────────────────

export const MessageBodySchema = z.discriminatedUnion('type', [
  AnnounceBodySchema,
  DiscoverBodySchema,
  DiscoverResultBodySchema,
  TaskRequestBodySchema,
  TaskAcceptBodySchema,
  TaskRejectBodySchema,
  TaskProgressBodySchema,
  TaskResultBodySchema,
  TaskCancelBodySchema,
  ReputationReportBodySchema,
]);

export type MessageBody = z.infer<typeof MessageBodySchema>;
