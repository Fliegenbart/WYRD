import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq, like, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { agents, capabilities, reputationScores, reputationEvents, type Db } from './db.js';
import { calculateReputation, type ReputationInput } from '@wyrd/reputation';

export function createRoutes(db: Db) {
  const app = new Hono();

  // Enable CORS for dashboard and external clients
  app.use('*', cors());

  // ── Health ───────────────────────────────────────────────────────────────

  app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

  // ── Agents ───────────────────────────────────────────────────────────────

  // Register / announce an agent
  app.post('/v1/agents', async (c) => {
    const body = await c.req.json();
    const now = Date.now();

    // Upsert agent
    db.insert(agents)
      .values({
        id: body.agentId,
        name: body.meta?.name ?? null,
        description: body.meta?.description ?? null,
        endpoint: body.endpoint,
        metaJson: body.meta ? JSON.stringify(body.meta) : null,
        registeredAt: now,
        lastSeenAt: now,
        ttl: body.ttl ?? 3600,
        status: 'online',
      })
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          endpoint: body.endpoint,
          name: body.meta?.name ?? null,
          description: body.meta?.description ?? null,
          metaJson: body.meta ? JSON.stringify(body.meta) : null,
          lastSeenAt: now,
          ttl: body.ttl ?? 3600,
          status: 'online',
        },
      })
      .run();

    // Upsert capabilities
    if (body.capabilities) {
      // Remove old capabilities for this agent
      db.delete(capabilities)
        .where(eq(capabilities.agentId, body.agentId))
        .run();

      for (const cap of body.capabilities) {
        db.insert(capabilities)
          .values({
            id: `${body.agentId}:${cap.id}`,
            agentId: body.agentId,
            capabilityId: cap.id,
            name: cap.name,
            description: cap.description,
            inputSchemaJson: cap.inputSchema ? JSON.stringify(cap.inputSchema) : null,
            outputSchemaJson: cap.outputSchema ? JSON.stringify(cap.outputSchema) : null,
            tagsJson: cap.tags ? JSON.stringify(cap.tags) : null,
            pricingJson: cap.pricing ? JSON.stringify(cap.pricing) : null,
            slaJson: cap.sla ? JSON.stringify(cap.sla) : null,
          })
          .run();
      }
    }

    // Initialize reputation if new
    const existingRep = db.select().from(reputationScores).where(eq(reputationScores.agentId, body.agentId)).get();
    if (!existingRep) {
      db.insert(reputationScores)
        .values({
          agentId: body.agentId,
          overallScore: 50,
          totalTasks: 0,
          successfulTasks: 0,
          totalRatings: 0,
          lastUpdatedAt: now,
        })
        .run();
    }

    return c.json({ ok: true, agentId: body.agentId }, 201);
  });

  // Get agent by ID
  app.get('/v1/agents/:id', (c) => {
    const id = c.req.param('id');
    const agent = db.select().from(agents).where(eq(agents.id, id)).get();
    if (!agent) return c.json({ error: 'Agent not found' }, 404);

    const caps = db.select().from(capabilities).where(eq(capabilities.agentId, id)).all();
    const rep = db.select().from(reputationScores).where(eq(reputationScores.agentId, id)).get();

    return c.json({
      ...agent,
      meta: agent.metaJson ? JSON.parse(agent.metaJson) : null,
      capabilities: caps.map(deserializeCapability),
      reputation: rep
        ? {
            overall: rep.overallScore,
            totalTasks: rep.totalTasks,
            confidenceLevel: getConfidence(rep.totalTasks ?? 0),
          }
        : { overall: 50, totalTasks: 0, confidenceLevel: 'low' },
    });
  });

  // Delete agent
  app.delete('/v1/agents/:id', (c) => {
    const id = c.req.param('id');
    db.delete(capabilities).where(eq(capabilities.agentId, id)).run();
    db.delete(agents).where(eq(agents.id, id)).run();
    return c.json({ ok: true });
  });

  // Heartbeat
  app.patch('/v1/agents/:id/heartbeat', (c) => {
    const id = c.req.param('id');
    db.update(agents)
      .set({ lastSeenAt: Date.now() })
      .where(eq(agents.id, id))
      .run();
    return c.json({ ok: true });
  });

  // ── Discovery ────────────────────────────────────────────────────────────

  app.get('/v1/discover', (c) => {
    const tags = c.req.query('tags')?.split(',').filter(Boolean);
    const text = c.req.query('text');
    const capabilityId = c.req.query('capabilityId');
    const minReputation = c.req.query('minReputation') ? Number(c.req.query('minReputation')) : undefined;
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 10;

    // Get all online agents
    let allAgents = db
      .select()
      .from(agents)
      .where(eq(agents.status, 'online'))
      .all();

    // Filter by tags or text or capability
    const results: typeof allAgents = [];

    for (const agent of allAgents) {
      const agentCaps = db
        .select()
        .from(capabilities)
        .where(eq(capabilities.agentId, agent.id))
        .all();

      let matches = true;

      // Tag filter
      if (tags?.length) {
        const agentTags = agentCaps.flatMap((c) =>
          c.tagsJson ? (JSON.parse(c.tagsJson) as string[]) : [],
        );
        matches = tags.some((t) => agentTags.includes(t));
      }

      // Text filter
      if (matches && text) {
        const searchText = text.toLowerCase();
        const nameMatch = agent.name?.toLowerCase().includes(searchText);
        const descMatch = agent.description?.toLowerCase().includes(searchText);
        const capMatch = agentCaps.some(
          (c) =>
            c.name.toLowerCase().includes(searchText) ||
            c.description.toLowerCase().includes(searchText),
        );
        matches = !!(nameMatch || descMatch || capMatch);
      }

      // Capability ID filter
      if (matches && capabilityId) {
        matches = agentCaps.some((c) => c.capabilityId === capabilityId);
      }

      // Reputation filter
      if (matches && minReputation !== undefined) {
        const rep = db
          .select()
          .from(reputationScores)
          .where(eq(reputationScores.agentId, agent.id))
          .get();
        matches = (rep?.overallScore ?? 50) >= minReputation;
      }

      if (matches) results.push(agent);
      if (results.length >= limit) break;
    }

    // Build response with capabilities and reputation
    const responseAgents = results.map((agent) => {
      const agentCaps = db
        .select()
        .from(capabilities)
        .where(eq(capabilities.agentId, agent.id))
        .all();

      const rep = db
        .select()
        .from(reputationScores)
        .where(eq(reputationScores.agentId, agent.id))
        .get();

      return {
        agentId: agent.id,
        name: agent.name,
        description: agent.description,
        capabilities: agentCaps.map(deserializeCapability),
        reputation: {
          overall: rep?.overallScore ?? 50,
          totalTasks: rep?.totalTasks ?? 0,
          confidenceLevel: getConfidence(rep?.totalTasks ?? 0),
        },
        endpoint: agent.endpoint,
      };
    });

    return c.json({ agents: responseAgents, total: responseAgents.length });
  });

  // ── Capabilities ─────────────────────────────────────────────────────────

  app.get('/v1/capabilities', (c) => {
    const allCaps = db.select().from(capabilities).all();
    return c.json({ capabilities: allCaps.map(deserializeCapability) });
  });

  // ── Reputation ───────────────────────────────────────────────────────────

  app.get('/v1/reputation/:agentId', (c) => {
    const agentId = c.req.param('agentId');
    const rep = db
      .select()
      .from(reputationScores)
      .where(eq(reputationScores.agentId, agentId))
      .get();

    if (!rep) return c.json({ error: 'Agent not found' }, 404);

    const score = calculateReputation({
      totalTasks: rep.totalTasks ?? 0,
      successfulTasks: rep.successfulTasks ?? 0,
      avgRating: rep.avgRating ?? 3,
      totalRatings: rep.totalRatings ?? 0,
      avgResponseMs: rep.avgResponseMs ?? 1000,
      ageDays: rep.ageDays ?? 0,
      ratingStdDev: rep.ratingStdDev ?? 0,
      inactiveDays: rep.inactiveDays ?? 0,
    });

    return c.json(score);
  });

  // Submit a reputation report
  app.post('/v1/reputation/report', async (c) => {
    const body = await c.req.json();
    const now = Date.now();

    db.insert(reputationEvents)
      .values({
        id: ulid(),
        subjectAgentId: body.subjectAgentId,
        reporterAgentId: body.reporterAgentId,
        taskId: body.taskId,
        rating: body.rating,
        dimensionsJson: body.dimensions ? JSON.stringify(body.dimensions) : null,
        comment: body.comment ?? null,
        createdAt: now,
      })
      .run();

    // Recalculate reputation for the subject
    const events = db
      .select()
      .from(reputationEvents)
      .where(eq(reputationEvents.subjectAgentId, body.subjectAgentId))
      .all();

    const ratings = events.map((e) => e.rating);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const variance = ratings.reduce((sum, r) => sum + (r - avgRating) ** 2, 0) / ratings.length;
    const stdDev = Math.sqrt(variance);

    db.update(reputationScores)
      .set({
        avgRating,
        totalRatings: ratings.length,
        ratingStdDev: stdDev,
        lastUpdatedAt: now,
      })
      .where(eq(reputationScores.agentId, body.subjectAgentId))
      .run();

    return c.json({ ok: true }, 201);
  });

  // ── Stats ────────────────────────────────────────────────────────────────

  app.get('/v1/stats', (c) => {
    const agentCount = db.select({ count: sql<number>`count(*)` }).from(agents).get();
    const onlineCount = db
      .select({ count: sql<number>`count(*)` })
      .from(agents)
      .where(eq(agents.status, 'online'))
      .get();
    const capCount = db.select({ count: sql<number>`count(*)` }).from(capabilities).get();

    return c.json({
      agents: {
        total: agentCount?.count ?? 0,
        online: onlineCount?.count ?? 0,
      },
      capabilities: capCount?.count ?? 0,
    });
  });

  return app;
}

function deserializeCapability(row: any) {
  return {
    id: row.capabilityId,
    name: row.name,
    description: row.description,
    inputSchema: row.inputSchemaJson ? JSON.parse(row.inputSchemaJson) : undefined,
    outputSchema: row.outputSchemaJson ? JSON.parse(row.outputSchemaJson) : undefined,
    tags: row.tagsJson ? JSON.parse(row.tagsJson) : [],
    pricing: row.pricingJson ? JSON.parse(row.pricingJson) : undefined,
    sla: row.slaJson ? JSON.parse(row.slaJson) : undefined,
  };
}

function getConfidence(totalTasks: number): 'low' | 'medium' | 'high' {
  if (totalTasks < 10) return 'low';
  if (totalTasks < 100) return 'medium';
  return 'high';
}
