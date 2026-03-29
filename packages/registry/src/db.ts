import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ── Schema ───────────────────────────────────────────────────────────────────

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name'),
  description: text('description'),
  endpoint: text('endpoint').notNull(),
  metaJson: text('meta_json'),
  registeredAt: integer('registered_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  ttl: integer('ttl').default(3600),
  status: text('status').default('online'),
});

export const capabilities = sqliteTable('capabilities', {
  id: text('id').primaryKey(), // agentId:capabilityId
  agentId: text('agent_id').notNull(),
  capabilityId: text('capability_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  inputSchemaJson: text('input_schema_json'),
  outputSchemaJson: text('output_schema_json'),
  tagsJson: text('tags_json'), // JSON array
  pricingJson: text('pricing_json'),
  slaJson: text('sla_json'),
});

export const reputationScores = sqliteTable('reputation_scores', {
  agentId: text('agent_id').primaryKey(),
  overallScore: real('overall_score').default(50),
  totalTasks: integer('total_tasks').default(0),
  successfulTasks: integer('successful_tasks').default(0),
  avgRating: real('avg_rating'),
  totalRatings: integer('total_ratings').default(0),
  avgResponseMs: integer('avg_response_ms'),
  ratingStdDev: real('rating_std_dev').default(0),
  ageDays: integer('age_days').default(0),
  inactiveDays: integer('inactive_days').default(0),
  lastUpdatedAt: integer('last_updated_at'),
});

export const reputationEvents = sqliteTable('reputation_events', {
  id: text('id').primaryKey(),
  subjectAgentId: text('subject_agent_id').notNull(),
  reporterAgentId: text('reporter_agent_id').notNull(),
  taskId: text('task_id').notNull(),
  rating: integer('rating').notNull(),
  dimensionsJson: text('dimensions_json'),
  comment: text('comment'),
  createdAt: integer('created_at').notNull(),
});

// ── Database initialization ──────────────────────────────────────────────────

export function createDb(path: string = ':memory:'): { db: ReturnType<typeof drizzle>; sqlite: InstanceType<typeof Database> } {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      endpoint TEXT NOT NULL,
      meta_json TEXT,
      registered_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      ttl INTEGER DEFAULT 3600,
      status TEXT DEFAULT 'online'
    );

    CREATE TABLE IF NOT EXISTS capabilities (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      capability_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      input_schema_json TEXT,
      output_schema_json TEXT,
      tags_json TEXT,
      pricing_json TEXT,
      sla_json TEXT
    );

    CREATE TABLE IF NOT EXISTS reputation_scores (
      agent_id TEXT PRIMARY KEY,
      overall_score REAL DEFAULT 50,
      total_tasks INTEGER DEFAULT 0,
      successful_tasks INTEGER DEFAULT 0,
      avg_rating REAL,
      total_ratings INTEGER DEFAULT 0,
      avg_response_ms INTEGER,
      rating_std_dev REAL DEFAULT 0,
      age_days INTEGER DEFAULT 0,
      inactive_days INTEGER DEFAULT 0,
      last_updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reputation_events (
      id TEXT PRIMARY KEY,
      subject_agent_id TEXT NOT NULL,
      reporter_agent_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      dimensions_json TEXT,
      comment TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_capabilities_agent ON capabilities(agent_id);
    CREATE INDEX IF NOT EXISTS idx_capabilities_tags ON capabilities(tags_json);
    CREATE INDEX IF NOT EXISTS idx_reputation_events_subject ON reputation_events(subject_agent_id);
  `);

  const db = drizzle(sqlite);
  return { db, sqlite };
}

export type Db = ReturnType<typeof createDb>['db'];
