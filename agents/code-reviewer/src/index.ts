import { Agent, defineCapability } from '@agentnet/sdk';
import { z } from 'zod';

interface Issue {
  severity: 'info' | 'warning' | 'error';
  line?: number;
  message: string;
  suggestion?: string;
}

function analyzeCode(code: string, language: string, focus: string): Issue[] {
  const lines = code.split('\n');
  const issues: Issue[] = [];

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (focus === 'all' || focus === 'bugs') {
      if (trimmed.includes('console.log')) issues.push({ severity: 'warning', line: lineNum, message: 'console.log left in code', suggestion: 'Remove or replace with proper logging' });
      if (trimmed.includes('== ') && !trimmed.includes('===')) issues.push({ severity: 'error', line: lineNum, message: 'Loose equality used', suggestion: 'Use === for strict comparison' });
      if (trimmed.includes('var ')) issues.push({ severity: 'warning', line: lineNum, message: 'var declaration found', suggestion: 'Use const or let instead' });
    }
    if (focus === 'all' || focus === 'style') {
      if (line.length > 120) issues.push({ severity: 'info', line: lineNum, message: `Line too long (${line.length} chars)`, suggestion: 'Keep lines under 120 characters' });
      if (trimmed.includes('TODO')) issues.push({ severity: 'info', line: lineNum, message: 'TODO comment found', suggestion: 'Resolve or track in issue tracker' });
    }
    if (focus === 'all' || focus === 'security') {
      if (trimmed.includes('eval(')) issues.push({ severity: 'error', line: lineNum, message: 'eval() is a security risk', suggestion: 'Avoid eval; use safer alternatives' });
      if (trimmed.includes('innerHTML')) issues.push({ severity: 'error', line: lineNum, message: 'innerHTML can cause XSS', suggestion: 'Use textContent or a sanitization library' });
      if (/password|secret|api[_-]?key/i.test(trimmed) && trimmed.includes('=')) issues.push({ severity: 'error', line: lineNum, message: 'Possible hardcoded secret', suggestion: 'Use environment variables' });
    }
  });

  if (lines.length > 50) issues.push({ severity: 'warning', message: `File is ${lines.length} lines long`, suggestion: 'Consider splitting into smaller modules' });
  if (code.includes(': any')) issues.push({ severity: 'warning', message: 'TypeScript `any` type used', suggestion: 'Replace with proper types' });

  return issues;
}

const reviewCode = defineCapability({
  id: 'review-code',
  name: 'Code Review',
  description: 'Reviews code for bugs, style issues, and security vulnerabilities',
  tags: ['code', 'review', 'development', 'quality'],
  input: z.object({
    code: z.string().describe('Source code to review'),
    language: z.string().default('typescript'),
    focus: z.enum(['bugs', 'style', 'security', 'all']).default('all'),
  }),
  output: z.object({
    issues: z.array(z.object({
      severity: z.enum(['info', 'warning', 'error']),
      line: z.number().optional(),
      message: z.string(),
      suggestion: z.string().optional(),
    })),
    summary: z.string(),
    score: z.number(),
  }),
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(20, 'Analyzing code structure...');
    await new Promise((r) => setTimeout(r, 200));
    ctx.progress(60, `Checking for ${input.focus} issues...`);
    const issues = analyzeCode(input.code, input.language, input.focus);
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const score = Math.max(0, 100 - errors * 15 - warnings * 5);
    const summary = issues.length === 0
      ? 'Code looks clean! No issues found.'
      : `Found ${issues.length} issues: ${errors} errors, ${warnings} warnings, ${issues.length - errors - warnings} info.`;
    ctx.progress(95, 'Review complete');
    return { issues, summary, score };
  },
});

const port = Number(process.env['PORT'] ?? 4214);
const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';
const agent = new Agent({ name: 'CodeReviewer', description: 'Reviews code for bugs, style, and security', capabilities: [reviewCode], registry: registryUrl, port });
agent.on('started', ({ id }) => { console.log(`🔍 CodeReviewer online\n   ID: ${id}\n   Port: ${port}`); });
agent.on('task:start', ({ taskId }) => { console.log(`   📋 Task ${taskId.slice(0, 8)}... → review-code`); });
agent.on('task:complete', ({ taskId, durationMs }) => { console.log(`   ✅ Task ${taskId.slice(0, 8)}... done in ${durationMs}ms`); });
agent.on('error', (err) => { console.error(`   ❌ Error:`, err.message); });
agent.start().catch(console.error);
process.on('SIGINT', async () => { await agent.stop(); process.exit(0); });
