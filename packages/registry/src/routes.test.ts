import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from './db.js';
import { createRoutes } from './routes.js';

describe('Registry Routes', () => {
  let app: ReturnType<typeof createRoutes>;

  beforeEach(() => {
    const { db } = createDb(':memory:');
    app = createRoutes(db);
  });

  it('health check returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('registers an agent', async () => {
    const res = await app.request('/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-001',
        endpoint: 'ws://localhost:4201',
        capabilities: [
          {
            id: 'search-flights',
            name: 'Flight Search',
            description: 'Search for flights',
            tags: ['travel', 'flights'],
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' },
          },
        ],
        meta: { name: 'FlightBot' },
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('retrieves a registered agent', async () => {
    // Register first
    await app.request('/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-002',
        endpoint: 'ws://localhost:4202',
        capabilities: [],
        meta: { name: 'TestBot' },
      }),
    });

    const res = await app.request('/v1/agents/agent-002');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('agent-002');
    expect(data.endpoint).toBe('ws://localhost:4202');
  });

  it('returns 404 for unknown agent', async () => {
    const res = await app.request('/v1/agents/unknown');
    expect(res.status).toBe(404);
  });

  it('discovers agents by tag', async () => {
    // Register two agents
    await app.request('/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'flight-agent',
        endpoint: 'ws://localhost:5001',
        capabilities: [
          { id: 'flights', name: 'Flights', description: 'Find flights', tags: ['travel', 'flights'] },
        ],
      }),
    });

    await app.request('/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'weather-agent',
        endpoint: 'ws://localhost:5002',
        capabilities: [
          { id: 'weather', name: 'Weather', description: 'Get weather', tags: ['weather'] },
        ],
      }),
    });

    // Discover by travel tag
    const res = await app.request('/v1/discover?tags=travel');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].agentId).toBe('flight-agent');
  });

  it('discovers agents by text search', async () => {
    await app.request('/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'code-agent',
        endpoint: 'ws://localhost:5003',
        capabilities: [
          { id: 'review', name: 'Code Review', description: 'Reviews code for bugs', tags: ['code'] },
        ],
        meta: { name: 'CodeReviewer' },
      }),
    });

    const res = await app.request('/v1/discover?text=code');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agents.length).toBeGreaterThanOrEqual(1);
    expect(data.agents[0].agentId).toBe('code-agent');
  });

  it('returns stats', async () => {
    const res = await app.request('/v1/stats');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agents).toBeDefined();
    expect(data.capabilities).toBeDefined();
  });

  it('submits a reputation report', async () => {
    // Register agent first
    await app.request('/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'rated-agent',
        endpoint: 'ws://localhost:5004',
        capabilities: [],
      }),
    });

    const res = await app.request('/v1/reputation/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectAgentId: 'rated-agent',
        reporterAgentId: 'reporter-agent',
        taskId: 'task-001',
        rating: 5,
      }),
    });

    expect(res.status).toBe(201);

    // Check reputation was updated
    const repRes = await app.request('/v1/reputation/rated-agent');
    expect(repRes.status).toBe(200);
  });
});
