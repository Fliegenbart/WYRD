import { describe, it, expect } from 'vitest';
import {
  AnnounceBodySchema,
  DiscoverBodySchema,
  TaskRequestBodySchema,
  TaskResultBodySchema,
  ReputationReportBodySchema,
  MessageBodySchema,
} from './messages.js';

describe('Protocol Messages', () => {
  it('validates an announce body', () => {
    const body = {
      type: 'announce' as const,
      capabilities: [
        {
          id: 'search-flights',
          name: 'Flight Search',
          description: 'Search for flights',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
          tags: ['travel', 'flights'],
        },
      ],
      endpoint: 'ws://localhost:4201',
      meta: { name: 'FlightBot' },
      ttl: 7200,
    };
    expect(AnnounceBodySchema.parse(body)).toEqual(body);
  });

  it('validates a discover body with defaults', () => {
    const body = {
      type: 'discover' as const,
      query: { tags: ['flights'] },
    };
    const parsed = DiscoverBodySchema.parse(body);
    expect(parsed.query.limit).toBe(10);
  });

  it('validates a task.request body', () => {
    const body = {
      type: 'task.request' as const,
      taskId: '01HXYZ123',
      capabilityId: 'search-flights',
      input: { origin: 'SFO', destination: 'JFK' },
    };
    expect(TaskRequestBodySchema.parse(body)).toEqual(body);
  });

  it('validates a task.result body', () => {
    const body = {
      type: 'task.result' as const,
      taskId: '01HXYZ123',
      status: 'success' as const,
      output: { flights: [] },
      metrics: { durationMs: 1500 },
    };
    expect(TaskResultBodySchema.parse(body)).toEqual(body);
  });

  it('validates a reputation.report body', () => {
    const body = {
      type: 'reputation.report' as const,
      taskId: '01HXYZ123',
      subjectAgentId: 'agent123',
      rating: 5,
      dimensions: { accuracy: 5, speed: 4 },
    };
    expect(ReputationReportBodySchema.parse(body)).toEqual(body);
  });

  it('rejects invalid rating values', () => {
    expect(() =>
      ReputationReportBodySchema.parse({
        type: 'reputation.report',
        taskId: '01HXYZ123',
        subjectAgentId: 'agent123',
        rating: 6,
      }),
    ).toThrow();
  });

  it('discriminated union resolves correct type', () => {
    const announce = {
      type: 'announce' as const,
      capabilities: [],
      endpoint: 'ws://localhost:4201',
    };
    const parsed = MessageBodySchema.parse(announce);
    expect(parsed.type).toBe('announce');
  });
});
