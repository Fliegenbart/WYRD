/**
 * WYRD — Code Review Swarm Demo
 *
 * A real-world use case: 3 specialized review agents analyze code in parallel,
 * each signing their findings. An orchestrator collects and merges results.
 * Every handoff is verifiable.
 *
 * This is the architecture that makes WYRD necessary:
 * you can't do verified multi-agent handoffs without identity + P2P + signatures.
 */

import { Agent, AgentClient, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m',
  gold: '\x1b[38;2;212;168;67m', green: '\x1b[32m',
  cyan: '\x1b[36m', red: '\x1b[31m', yellow: '\x1b[33m',
  mag: '\x1b[35m',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Review Issue Schema ──────────────────────────────────────────────────────

const IssueSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']),
  message: z.string(),
  suggestion: z.string().optional(),
});

const ReviewOutputSchema = z.object({
  domain: z.string(),
  issues: z.array(IssueSchema),
  score: z.number(),
  verdict: z.string(),
});

// ── Specialized Review Agents ────────────────────────────────────────────────

function securityAgent() {
  return new Agent({
    name: 'SecurityReviewer',
    description: 'Checks code for security vulnerabilities',
    capabilities: [
      defineCapability({
        id: 'review-security',
        name: 'Security Review',
        description: 'Static analysis for security issues',
        tags: ['code', 'security', 'review'],
        input: z.object({ code: z.string(), language: z.string() }),
        output: ReviewOutputSchema,
        handler: async (input, ctx) => {
          ctx.progress(30, 'Scanning for vulnerabilities...');
          await sleep(100);
          const issues: z.infer<typeof IssueSchema>[] = [];
          const code = input.code;
          if (code.includes('eval(')) issues.push({ severity: 'critical', message: 'eval() allows arbitrary code execution', suggestion: 'Use JSON.parse() or a safe parser' });
          if (code.includes('innerHTML')) issues.push({ severity: 'critical', message: 'innerHTML enables XSS attacks', suggestion: 'Use textContent or DOMPurify' });
          if (/password|secret|api.?key/i.test(code) && /[=:]\s*['"]/.test(code)) issues.push({ severity: 'critical', message: 'Hardcoded secret detected', suggestion: 'Use environment variables' });
          if (code.includes('http://') && !code.includes('localhost')) issues.push({ severity: 'warning', message: 'Insecure HTTP connection', suggestion: 'Use HTTPS' });
          if (code.includes('console.log') && /password|token|secret/i.test(code)) issues.push({ severity: 'warning', message: 'Sensitive data may be logged', suggestion: 'Remove logging of secrets' });
          ctx.progress(90, 'Analysis complete');
          const score = Math.max(0, 100 - issues.filter((i) => i.severity === 'critical').length * 25 - issues.filter((i) => i.severity === 'warning').length * 10);
          return { domain: 'security', issues, score, verdict: score >= 80 ? 'PASS' : score >= 50 ? 'NEEDS WORK' : 'FAIL' };
        },
      }),
    ],
  });
}

function performanceAgent() {
  return new Agent({
    name: 'PerformanceReviewer',
    description: 'Checks code for performance issues',
    capabilities: [
      defineCapability({
        id: 'review-performance',
        name: 'Performance Review',
        description: 'Analyze code for performance bottlenecks',
        tags: ['code', 'performance', 'review'],
        input: z.object({ code: z.string(), language: z.string() }),
        output: ReviewOutputSchema,
        handler: async (input, ctx) => {
          ctx.progress(30, 'Profiling code patterns...');
          await sleep(80);
          const issues: z.infer<typeof IssueSchema>[] = [];
          const code = input.code;
          const lines = code.split('\n');
          if (lines.length > 100) issues.push({ severity: 'warning', message: `File is ${lines.length} lines — consider splitting`, suggestion: 'Extract functions into separate modules' });
          if (/for\s*\(.*for\s*\(/s.test(code)) issues.push({ severity: 'warning', message: 'Nested loops detected — O(n²) risk', suggestion: 'Use Map/Set for lookups or flatten logic' });
          if ((code.match(/await /g) ?? []).length > 5) issues.push({ severity: 'info', message: 'Many sequential awaits — consider Promise.all()', suggestion: 'Parallelize independent async operations' });
          if (code.includes('JSON.parse') && !code.includes('try')) issues.push({ severity: 'warning', message: 'Unguarded JSON.parse can throw', suggestion: 'Wrap in try/catch' });
          if (/\.filter\(.*\)\.map\(/.test(code)) issues.push({ severity: 'info', message: 'filter().map() iterates twice', suggestion: 'Use reduce() or flatMap() for single pass' });
          ctx.progress(90, 'Analysis complete');
          const score = Math.max(0, 100 - issues.filter((i) => i.severity === 'warning').length * 12 - issues.filter((i) => i.severity === 'info').length * 3);
          return { domain: 'performance', issues, score, verdict: score >= 80 ? 'PASS' : score >= 50 ? 'NEEDS WORK' : 'FAIL' };
        },
      }),
    ],
  });
}

function styleAgent() {
  return new Agent({
    name: 'StyleReviewer',
    description: 'Checks code for style and maintainability',
    capabilities: [
      defineCapability({
        id: 'review-style',
        name: 'Style Review',
        description: 'Check code style, readability, and best practices',
        tags: ['code', 'style', 'review'],
        input: z.object({ code: z.string(), language: z.string() }),
        output: ReviewOutputSchema,
        handler: async (input, ctx) => {
          ctx.progress(30, 'Checking style...');
          await sleep(60);
          const issues: z.infer<typeof IssueSchema>[] = [];
          const code = input.code;
          if (code.includes('var ')) issues.push({ severity: 'warning', message: 'var declaration — use const/let', suggestion: 'Replace var with const or let' });
          if (code.includes(': any')) issues.push({ severity: 'warning', message: 'TypeScript any type bypasses type safety', suggestion: 'Use proper types or unknown' });
          if (code.includes('TODO')) issues.push({ severity: 'info', message: 'TODO comment found', suggestion: 'Resolve or create a ticket' });
          if (code.includes('console.log')) issues.push({ severity: 'info', message: 'console.log in production code', suggestion: 'Use a structured logger' });
          const longLines = code.split('\n').filter((l) => l.length > 120);
          if (longLines.length > 0) issues.push({ severity: 'info', message: `${longLines.length} lines exceed 120 chars`, suggestion: 'Break long lines for readability' });
          if (!/\/\*\*|\/\//.test(code)) issues.push({ severity: 'info', message: 'No comments or JSDoc found', suggestion: 'Document public functions' });
          ctx.progress(90, 'Analysis complete');
          const score = Math.max(0, 100 - issues.filter((i) => i.severity === 'warning').length * 10 - issues.filter((i) => i.severity === 'info').length * 3);
          return { domain: 'style', issues, score, verdict: score >= 80 ? 'PASS' : 'NEEDS WORK' };
        },
      }),
    ],
  });
}

// ── Demo ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
${c.b}${c.gold}  ╦ ╦╦ ╦╦═╗╔╦╗
  ║║║╚╦╝╠╦╝ ║║
  ╚╩╝ ╩ ╩╚══╩╝  Code Review Swarm${c.r}
  ${c.d}3 specialized agents · parallel review · verifiable handoffs${c.r}
`);

  // Sample code to review
  const code = `
function fetchUserData(userId) {
  var apiKey = "sk-1234567890abcdef";
  var url = "http://api.example.com/users/" + userId;

  for (var i = 0; i < users.length; i++) {
    for (var j = 0; j < users[i].orders.length; j++) {
      var total = eval(users[i].orders[j].amount);
      console.log("Processing order for user " + userId + " token: " + apiKey);
      document.getElementById("output").innerHTML = total;
    }
  }

  var data = JSON.parse(response);
  var filtered = data.filter(x => x.active).map(x => x.name);
  // TODO: add error handling
  return filtered;
}`.trim();

  console.log(`${c.d}Code to review:${c.r}`);
  console.log(`${c.d}${'─'.repeat(60)}${c.r}`);
  code.split('\n').forEach((line, i) => {
    console.log(`${c.d}${String(i + 1).padStart(3)}${c.r} ${line}`);
  });
  console.log(`${c.d}${'─'.repeat(60)}${c.r}\n`);

  // Start the swarm
  const sec = securityAgent();
  const perf = performanceAgent();
  const style = styleAgent();

  console.log(`${c.d}Starting review swarm...${c.r}`);
  await Promise.all([sec.start(), perf.start(), style.start()]);

  console.log(`${c.green}  ✓${c.r} ${c.red}SecurityReviewer${c.r}     → http://localhost:${sec.port} (${sec.id.slice(0, 12)}...)`);
  console.log(`${c.green}  ✓${c.r} ${c.cyan}PerformanceReviewer${c.r} → http://localhost:${perf.port} (${perf.id.slice(0, 12)}...)`);
  console.log(`${c.green}  ✓${c.r} ${c.mag}StyleReviewer${c.r}        → http://localhost:${style.port} (${style.id.slice(0, 12)}...)\n`);

  // Run all reviews in parallel via P2P
  const client = new AgentClient({});
  console.log(`${c.gold}Running 3 reviews in parallel (P2P, no registry)...${c.r}\n`);

  const start = Date.now();
  const [secResult, perfResult, styleResult] = await Promise.all([
    client.directTask<z.infer<typeof ReviewOutputSchema>>(`http://localhost:${sec.port}`, 'review-security', { code, language: 'typescript' }),
    client.directTask<z.infer<typeof ReviewOutputSchema>>(`http://localhost:${perf.port}`, 'review-performance', { code, language: 'typescript' }),
    client.directTask<z.infer<typeof ReviewOutputSchema>>(`http://localhost:${style.port}`, 'review-style', { code, language: 'typescript' }),
  ]);
  const totalMs = Date.now() - start;

  // Display results
  const reviews = [
    { result: secResult, color: c.red, icon: '🔒' },
    { result: perfResult, color: c.cyan, icon: '⚡' },
    { result: styleResult, color: c.mag, icon: '✨' },
  ];

  for (const { result, color, icon } of reviews) {
    const r = result.output;
    const verdictColor = r.verdict === 'PASS' ? c.green : r.verdict === 'FAIL' ? c.red : c.yellow;
    console.log(`${icon} ${color}${c.b}${r.domain.toUpperCase()} REVIEW${c.r}  ${verdictColor}${r.verdict}${c.r}  score: ${r.score}/100  signed by: ${c.d}${result.agent.id.slice(0, 16)}...${c.r}`);

    for (const issue of r.issues) {
      const sevColor = issue.severity === 'critical' ? c.red : issue.severity === 'warning' ? c.yellow : c.d;
      const sevIcon = issue.severity === 'critical' ? '✖' : issue.severity === 'warning' ? '⚠' : 'ℹ';
      console.log(`   ${sevColor}${sevIcon}${c.r} ${issue.message}`);
      if (issue.suggestion) console.log(`     ${c.d}→ ${issue.suggestion}${c.r}`);
    }
    console.log();
  }

  // Summary
  const allIssues = reviews.flatMap((r) => r.result.output.issues);
  const criticals = allIssues.filter((i) => i.severity === 'critical').length;
  const warnings = allIssues.filter((i) => i.severity === 'warning').length;
  const infos = allIssues.filter((i) => i.severity === 'info').length;
  const avgScore = Math.round(reviews.reduce((sum, r) => sum + r.result.output.score, 0) / reviews.length);

  console.log(`${c.b}${c.gold}SWARM SUMMARY${c.r}`);
  console.log(`  ${c.red}${criticals} critical${c.r}  ${c.yellow}${warnings} warnings${c.r}  ${c.d}${infos} info${c.r}`);
  console.log(`  Average score: ${avgScore >= 70 ? c.green : avgScore >= 40 ? c.yellow : c.red}${avgScore}/100${c.r}`);
  console.log(`  Total time: ${c.gold}${totalMs}ms${c.r} (3 agents in parallel)`);
  console.log(`  Each review independently signed with Ed25519`);
  console.log(`\n${c.d}This is why WYRD exists: verifiable multi-agent collaboration`);
  console.log(`where every handoff has a cryptographic proof of who did what.${c.r}\n`);

  await client.close();
  await Promise.all([sec.stop(), perf.stop(), style.stop()]);
  process.exit(0);
}

main().catch((err) => {
  console.error(`${c.red}Error:${c.r}`, err.message);
  process.exit(1);
});
