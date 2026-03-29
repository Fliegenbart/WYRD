import { serve } from '@hono/node-server';
import { createDb } from './db.js';
import { createRoutes } from './routes.js';

export interface RegistryOptions {
  port?: number;
  dbPath?: string;
}

export function createRegistry(options: RegistryOptions = {}) {
  const port = options.port ?? 4200;
  const { db, sqlite } = createDb(options.dbPath ?? ':memory:');
  const app = createRoutes(db);

  const server = serve({ fetch: app.fetch, port });

  return {
    app,
    db,
    server,
    port,
    close() {
      server.close();
      sqlite.close();
    },
  };
}
