import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { generateIdentity } from '@wyrd/identity';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(msg: string) { console.log(msg); }
function success(msg: string) { log(`  ${COLORS.green}✓${COLORS.reset} ${msg}`); }
function info(msg: string) { log(`  ${COLORS.blue}→${COLORS.reset} ${msg}`); }

async function main() {
  const args = process.argv.slice(2);
  const name = args[0];

  if (!name || name === '--help' || name === '-h') {
    log(`
${COLORS.bold}${COLORS.cyan}create-wyrd${COLORS.reset} — scaffold a new WYRD agent

${COLORS.bold}Usage:${COLORS.reset}
  npx create-wyrd <agent-name>
  npx create-wyrd my-weather-agent

${COLORS.bold}Options:${COLORS.reset}
  --registry <url>    Registry URL (default: http://localhost:4200)
  --port <number>     Agent port (default: 4201)
  --help              Show this help message
`);
    process.exit(0);
  }

  const registryUrl = getArg(args, '--registry') ?? 'http://localhost:4200';
  const port = getArg(args, '--port') ?? '4201';

  log(`\n${COLORS.bold}${COLORS.cyan}  create-wyrd${COLORS.reset}\n`);
  info(`Creating agent: ${COLORS.bold}${name}${COLORS.reset}`);

  // Create directory
  const dir = join(process.cwd(), name);
  if (existsSync(dir)) {
    log(`\n  ${COLORS.red}Error:${COLORS.reset} Directory "${name}" already exists.\n`);
    process.exit(1);
  }
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'src', 'capabilities'), { recursive: true });

  // Generate identity
  info('Generating agent identity...');
  const identity = await generateIdentity();
  success(`Agent ID: ${identity.id.slice(0, 16)}...`);

  // Write package.json
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'tsx src/index.ts',
          build: 'tsup src/index.ts --format esm',
        },
        dependencies: {
          '@wyrd/sdk': '^0.1.0',
          zod: '^3.24.0',
        },
        devDependencies: {
          tsup: '^8.4.0',
          tsx: '^4.19.0',
          typescript: '^5.8.0',
        },
      },
      null,
      2,
    ),
  );
  success('Created package.json');

  // Write tsconfig.json
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          lib: ['ES2022'],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: './dist',
          rootDir: './src',
          declaration: true,
          verbatimModuleSyntax: true,
          types: ['node'],
        },
        include: ['src'],
      },
      null,
      2,
    ),
  );
  success('Created tsconfig.json');

  // Write .env
  writeFileSync(
    join(dir, '.env'),
    `WYRD_PRIVATE_KEY=${identity.exportPrivateKey()}\nWYRD_REGISTRY_URL=${registryUrl}\nPORT=${port}\n`,
  );
  success('Created .env with agent identity');

  // Write .gitignore
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\ndist/\n.env\n');
  success('Created .gitignore');

  // Write example capability
  writeFileSync(
    join(dir, 'src', 'capabilities', 'hello.ts'),
    `import { defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

export const hello = defineCapability({
  id: 'hello',
  name: 'Hello',
  description: 'A friendly greeting capability',
  tags: ['greeting', 'demo'],
  input: z.object({
    name: z.string().describe('Name to greet'),
  }),
  output: z.object({
    greeting: z.string(),
    timestamp: z.string(),
  }),
  handler: async (input, ctx) => {
    ctx.progress(50, \`Preparing greeting for \${input.name}...\`);
    return {
      greeting: \`Hello, \${input.name}! Welcome to WYRD.\`,
      timestamp: new Date().toISOString(),
    };
  },
});
`,
  );
  success('Created src/capabilities/hello.ts');

  // Write agent entrypoint
  writeFileSync(
    join(dir, 'src', 'index.ts'),
    `import { Agent } from '@wyrd/sdk';
import { hello } from './capabilities/hello.js';

const agent = new Agent({
  name: '${name}',
  description: 'My WYRD agent',
  capabilities: [hello],
  registry: process.env['WYRD_REGISTRY_URL'] ?? '${registryUrl}',
  port: Number(process.env['PORT'] ?? ${port}),
  privateKey: process.env['WYRD_PRIVATE_KEY'],
});

agent.on('started', ({ id }) => {
  console.log(\`Agent online: \${id}\`);
});

agent.on('task:complete', ({ taskId, durationMs }) => {
  console.log(\`Task \${taskId.slice(0, 8)}... completed in \${durationMs}ms\`);
});

agent.start().catch(console.error);
`,
  );
  success('Created src/index.ts');

  // Install dependencies
  info('Installing dependencies...');
  try {
    execSync('pnpm install', { cwd: dir, stdio: 'pipe' });
    success('Dependencies installed');
  } catch {
    try {
      execSync('npm install', { cwd: dir, stdio: 'pipe' });
      success('Dependencies installed');
    } catch {
      info('Run "pnpm install" or "npm install" to install dependencies');
    }
  }

  log(`
${COLORS.bold}${COLORS.green}  Done!${COLORS.reset} Your agent is ready.

  ${COLORS.dim}cd ${name}${COLORS.reset}
  ${COLORS.dim}npm run dev${COLORS.reset}

  Your agent will connect to the registry at ${registryUrl}
  and announce its capabilities automatically.
`);
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

main().catch((err) => {
  console.error(`\n  ${COLORS.red}Error:${COLORS.reset} ${err.message}\n`);
  process.exit(1);
});
