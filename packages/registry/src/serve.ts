import { createRegistry } from './server.js';

const port = Number(process.env['PORT'] ?? 4200);
const dbPath = process.env['DB_PATH'] ?? ':memory:';

const registry = createRegistry({ port, dbPath });

console.log(`AgentNet Registry running on http://localhost:${port}`);
console.log(`Database: ${dbPath === ':memory:' ? 'in-memory' : dbPath}`);

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  registry.close();
  process.exit(0);
});
