/**
 * AgentNet Demo — Full Network
 *
 * Starts the registry + all 8 agents, then runs demo scenarios
 * showing discovery, direct tasks, and multi-agent collaboration.
 */

import { createRegistry } from '@wyrd/registry';
import { Agent, AgentClient, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

// ── Colors ───────────────────────────────────────────────────────────────────

const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m',
  green: '\x1b[32m', blue: '\x1b[34m', cyan: '\x1b[36m',
  yellow: '\x1b[33m', magenta: '\x1b[35m', red: '\x1b[31m', white: '\x1b[37m',
};

function log(prefix: string, color: string, msg: string) {
  console.log(`${color}${prefix}${c.r} ${msg}`);
}

// ── Banner ───────────────────────────────────────────────────────────────────

console.log(`
${c.b}${c.cyan}
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║          A G E N T N E T   D E M O                    ║
    ║          ─────────────────────────                    ║
    ║   The open protocol for agent-to-agent communication  ║
    ║                                                       ║
    ║   8 agents · 9 capabilities · 1 network               ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
${c.r}
`);

const REGISTRY = 'http://localhost:4200';

// ── Helper: inline agent creator ─────────────────────────────────────────────

function inlineAgent(
  name: string, description: string, port: number,
  caps: ReturnType<typeof defineCapability>[],
) {
  return new Agent({ name, description, capabilities: caps, registry: REGISTRY, port });
}

// ── Step 1: Start Registry ───────────────────────────────────────────────────

log('[Registry]', c.blue, 'Starting discovery registry...');
const registry = createRegistry({ port: 4200 });
log('[Registry]', c.green, 'Online at http://localhost:4200');

// ── Step 2: Define & Start All 8 Agents ──────────────────────────────────────

const agents: Agent[] = [];

// 1. Weather
agents.push(inlineAgent('WeatherBot', 'Weather forecasts', 4211, [
  defineCapability({
    id: 'get-weather', name: 'Weather', description: 'Get weather for a city',
    tags: ['weather', 'forecast'],
    input: z.object({ city: z.string(), units: z.enum(['celsius', 'fahrenheit']).default('celsius') }),
    output: z.object({ city: z.string(), temperature: z.number(), units: z.string(), conditions: z.string(), humidity: z.number(), wind: z.string(), timestamp: z.string() }),
    handler: async (input, ctx) => {
      ctx.progress(50, `Checking ${input.city}...`);
      await new Promise((r) => setTimeout(r, 150));
      const temps: Record<string, number> = { tokyo: 18, 'new york': 22, london: 14, berlin: 12, paris: 16, 'san francisco': 17, sydney: 25 };
      const conds: Record<string, string> = { tokyo: 'Partly Cloudy', 'new york': 'Sunny', london: 'Rainy', berlin: 'Cloudy', paris: 'Overcast', 'san francisco': 'Foggy', sydney: 'Sunny' };
      const k = input.city.toLowerCase();
      const temp = temps[k] ?? Math.round(15 + Math.random() * 15);
      return { city: input.city, temperature: input.units === 'fahrenheit' ? Math.round(temp * 9/5 + 32) : temp, units: input.units, conditions: conds[k] ?? 'Clear', humidity: 65, wind: '12 km/h', timestamp: new Date().toISOString() };
    },
  }),
]));

// 2. Translator
agents.push(inlineAgent('TranslatorBot', 'Text translation', 4212, [
  defineCapability({
    id: 'translate-text', name: 'Translation', description: 'Translate text between languages',
    tags: ['translation', 'language'],
    input: z.object({ text: z.string(), from: z.string(), to: z.string() }),
    output: z.object({ original: z.string(), translated: z.string(), from: z.string(), to: z.string(), fromLanguage: z.string(), toLanguage: z.string(), confidence: z.number() }),
    handler: async (input, ctx) => {
      ctx.progress(50, 'Translating...');
      await new Promise((r) => setTimeout(r, 100));
      const dict: Record<string, Record<string, string>> = {
        'en→ja': { hello: 'こんにちは', 'thank you': 'ありがとう', goodbye: 'さようなら', 'good morning': 'おはようございます', 'how much': 'いくらですか' },
        'en→de': { hello: 'Hallo', 'thank you': 'Danke', goodbye: 'Auf Wiedersehen', 'good morning': 'Guten Morgen', 'how much': 'Wie viel kostet das' },
        'en→es': { hello: 'Hola', 'thank you': 'Gracias', goodbye: 'Adiós', 'good morning': 'Buenos días', 'how much': '¿Cuánto cuesta?' },
      };
      const key = `${input.from}→${input.to}`;
      const langs: Record<string, string> = { en: 'English', ja: 'Japanese', de: 'German', es: 'Spanish' };
      const translated = dict[key]?.[input.text.toLowerCase()] ?? `[${input.to}] ${input.text}`;
      return { original: input.text, translated, from: input.from, to: input.to, fromLanguage: langs[input.from] ?? input.from, toLanguage: langs[input.to] ?? input.to, confidence: dict[key]?.[input.text.toLowerCase()] ? 0.98 : 0.3 };
    },
  }),
]));

// 3. Flight Finder
agents.push(inlineAgent('FlightFinder', 'Flight search', 4213, [
  defineCapability({
    id: 'search-flights', name: 'Flights', description: 'Search flights',
    tags: ['travel', 'flights', 'booking'],
    input: z.object({ origin: z.string(), destination: z.string(), date: z.string(), passengers: z.number().default(1) }),
    output: z.object({ flights: z.array(z.object({ airline: z.string(), flightNumber: z.string(), price: z.number(), currency: z.string(), duration: z.string() })) }),
    handler: async (input, ctx) => {
      ctx.progress(40, `Searching ${input.origin} → ${input.destination}...`);
      await new Promise((r) => setTimeout(r, 200));
      const airlines = ['Lufthansa', 'Emirates', 'ANA', 'Delta', 'Singapore Airlines'];
      const flights = airlines.slice(0, 3 + Math.floor(Math.random() * 2)).map((airline, i) => ({
        airline, flightNumber: `${airline.slice(0, 2).toUpperCase()}${100 + i * 111}`,
        price: Math.round((300 + Math.random() * 1000) * input.passengers),
        currency: 'USD', duration: `${8 + Math.floor(Math.random() * 8)}h ${Math.floor(Math.random() * 4) * 15}m`,
      })).sort((a, b) => a.price - b.price);
      ctx.progress(90, `Found ${flights.length} flights`);
      return { flights };
    },
  }),
]));

// 4. Code Reviewer
agents.push(inlineAgent('CodeReviewer', 'Code review', 4214, [
  defineCapability({
    id: 'review-code', name: 'Code Review', description: 'Review code for issues',
    tags: ['code', 'review', 'development'],
    input: z.object({ code: z.string(), language: z.string().default('typescript'), focus: z.enum(['bugs', 'style', 'security', 'all']).default('all') }),
    output: z.object({ issues: z.array(z.object({ severity: z.enum(['info', 'warning', 'error']), message: z.string(), suggestion: z.string().optional() })), summary: z.string(), score: z.number() }),
    handler: async (input, ctx) => {
      ctx.progress(40, 'Analyzing...');
      await new Promise((r) => setTimeout(r, 150));
      const issues: any[] = [];
      if (input.code.includes('console.log')) issues.push({ severity: 'warning', message: 'console.log left in code', suggestion: 'Use proper logging' });
      if (input.code.includes('var ')) issues.push({ severity: 'warning', message: 'var declaration', suggestion: 'Use const/let' });
      if (input.code.includes('eval(')) issues.push({ severity: 'error', message: 'eval() is a security risk', suggestion: 'Avoid eval' });
      if (input.code.includes(': any')) issues.push({ severity: 'warning', message: 'TypeScript any type', suggestion: 'Use proper types' });
      const score = Math.max(0, 100 - issues.filter((i) => i.severity === 'error').length * 15 - issues.filter((i) => i.severity === 'warning').length * 5);
      return { issues, summary: issues.length === 0 ? 'Clean code!' : `Found ${issues.length} issues`, score };
    },
  }),
]));

// 5. Research Assistant
agents.push(inlineAgent('ResearchAssistant', 'Topic research', 4215, [
  defineCapability({
    id: 'research-topic', name: 'Research', description: 'Research any topic',
    tags: ['research', 'analysis', 'knowledge'],
    input: z.object({ topic: z.string(), depth: z.enum(['brief', 'detailed']).default('brief') }),
    output: z.object({ summary: z.string(), keyFindings: z.array(z.string()), confidence: z.number() }),
    handler: async (input, ctx) => {
      ctx.progress(30, `Researching "${input.topic}"...`);
      await new Promise((r) => setTimeout(r, 250));
      ctx.progress(70, 'Compiling findings...');
      const topics: Record<string, { summary: string; findings: string[] }> = {
        ai: { summary: 'AI is advancing rapidly with transformer architectures and agent-based systems.', findings: ['Transformers dominate NLP and vision', 'Agent-based AI is emerging', 'Safety research is critical'] },
        climate: { summary: 'Climate science shows accelerating warming with 1.2°C above pre-industrial levels.', findings: ['Arctic ice declining 13% per decade', 'Renewable energy grew 50% in 2023', 'Carbon capture advancing'] },
      };
      const key = Object.keys(topics).find((k) => input.topic.toLowerCase().includes(k));
      const data = key ? topics[key] : { summary: `Active research area with ongoing developments in ${input.topic}.`, findings: [`${input.topic} is evolving rapidly`, 'Cross-disciplinary applications emerging'] };
      return { ...data, keyFindings: data.findings, confidence: key ? 0.85 : 0.5 };
    },
  }),
]));

// 6. Price Tracker
agents.push(inlineAgent('PriceTracker', 'Price comparison', 4216, [
  defineCapability({
    id: 'track-price', name: 'Prices', description: 'Compare prices',
    tags: ['shopping', 'price', 'deals'],
    input: z.object({ product: z.string(), currency: z.string().default('USD') }),
    output: z.object({ product: z.string(), results: z.array(z.object({ store: z.string(), price: z.number(), inStock: z.boolean() })), lowestPrice: z.number() }),
    handler: async (input, ctx) => {
      ctx.progress(40, `Searching "${input.product}"...`);
      await new Promise((r) => setTimeout(r, 180));
      const stores = ['Amazon', 'Best Buy', 'Walmart', 'eBay', 'Target'];
      const base = input.product.length * 12 + 50;
      const results = stores.slice(0, 3 + Math.floor(Math.random() * 2)).map((store) => ({
        store, price: Math.round(base * (0.85 + Math.random() * 0.3) * 100) / 100, inStock: Math.random() > 0.15,
      })).sort((a, b) => a.price - b.price);
      return { product: input.product, results, lowestPrice: results[0].price };
    },
  }),
]));

// 7. News Summarizer
agents.push(inlineAgent('NewsSummarizer', 'News summaries', 4217, [
  defineCapability({
    id: 'summarize-news', name: 'News', description: 'Summarize news',
    tags: ['news', 'summary', 'media'],
    input: z.object({ topic: z.string(), count: z.number().default(3) }),
    output: z.object({ articles: z.array(z.object({ title: z.string(), source: z.string(), sentiment: z.enum(['positive', 'neutral', 'negative']) })), overallSentiment: z.string() }),
    handler: async (input, ctx) => {
      ctx.progress(40, `Scanning news for "${input.topic}"...`);
      await new Promise((r) => setTimeout(r, 200));
      const sources = ['Reuters', 'AP News', 'BBC', 'Bloomberg', 'TechCrunch'];
      const articles = Array.from({ length: Math.min(input.count, 4) }, (_, i) => ({
        title: `${['Breaking:', 'Update:', 'Analysis:', 'Report:'][i]} ${input.topic} — Latest Developments`,
        source: sources[i % sources.length],
        sentiment: (['positive', 'neutral', 'neutral', 'negative'] as const)[i],
      }));
      return { articles, overallSentiment: 'neutral' };
    },
  }),
]));

// 8. Orchestrator
agents.push(inlineAgent('Orchestrator', 'Multi-agent orchestration', 4210, [
  defineCapability({
    id: 'plan-trip', name: 'Trip Planner', description: 'Plan a trip using multiple agents',
    tags: ['orchestration', 'travel', 'planning'],
    input: z.object({ destination: z.string(), language: z.string().default('en') }),
    output: z.object({ destination: z.string(), weather: z.any().optional(), phrases: z.array(z.any()).optional(), flights: z.any().optional(), agentsUsed: z.array(z.string()), totalDurationMs: z.number() }),
    handler: async (input, ctx) => {
      const start = Date.now();
      const used: string[] = [];
      const oc = new AgentClient({ registry: REGISTRY });
      const results: any = {};

      ctx.progress(10, 'Finding weather agent...');
      try {
        const wa = await oc.discover({ tags: ['weather'], limit: 1 });
        if (wa[0]) {
          const r = await oc.task(wa[0].agentId, 'get-weather', { city: input.destination });
          results.weather = r.output;
          used.push('WeatherBot');
          ctx.progress(30, `Weather: ${(r.output as any).conditions}`);
        }
      } catch {}

      ctx.progress(40, 'Finding flight agent...');
      try {
        const fa = await oc.discover({ tags: ['flights'], limit: 1 });
        if (fa[0]) {
          const r = await oc.task(fa[0].agentId, 'search-flights', { origin: 'SFO', destination: input.destination.slice(0, 3).toUpperCase(), date: '2026-05-01' });
          results.flights = r.output;
          used.push('FlightFinder');
          ctx.progress(60, `Found ${(r.output as any).flights?.length} flights`);
        }
      } catch {}

      if (input.language !== 'en') {
        ctx.progress(70, 'Finding translator...');
        try {
          const ta = await oc.discover({ tags: ['translation'], limit: 1 });
          if (ta[0]) {
            const phrases = [];
            for (const text of ['hello', 'thank you', 'how much']) {
              const r = await oc.task(ta[0].agentId, 'translate-text', { text, from: 'en', to: input.language });
              phrases.push(r.output);
            }
            results.phrases = phrases;
            used.push('TranslatorBot');
          }
        } catch {}
      }

      await oc.close();
      ctx.progress(95, 'Compiling plan...');
      return { destination: input.destination, ...results, agentsUsed: used, totalDurationMs: Date.now() - start };
    },
  }),
]));

// ── Start all agents ─────────────────────────────────────────────────────────

const icons = ['🌤️', '🌐', '✈️', '🔍', '🔬', '💰', '📰', '🎯'];
for (let i = 0; i < agents.length; i++) {
  await agents[i].start();
  log(`  ${icons[i]}`, c.green, `${agents[i].config.name} online (${agents[i].id.slice(0, 10)}...) port ${agents[i].port}`);
}

// ── Demo Scenarios ───────────────────────────────────────────────────────────

const client = new AgentClient({ registry: REGISTRY });

// Scenario 1: Discovery
console.log(`\n${c.b}${c.cyan}━━━ 1. Agent Discovery ━━━${c.r}\n`);
const discovered = await client.discover({});
console.log(`  Found ${c.b}${discovered.length}${c.r} agents on the network:\n`);
for (const a of discovered) {
  const caps = a.capabilities.map((cap) => cap.id).join(', ');
  console.log(`    ${c.b}${a.name}${c.r}  ${c.d}${a.agentId.slice(0, 10)}...${c.r}  capabilities: ${c.cyan}${caps}${c.r}`);
}

// Scenario 2: Weather + Translation
console.log(`\n${c.b}${c.cyan}━━━ 2. Weather Across Cities ━━━${c.r}\n`);
for (const city of ['Tokyo', 'New York', 'Berlin']) {
  const r = await client.task(discovered.find((a) => a.name === 'WeatherBot')!.agentId, 'get-weather', { city });
  const w = r.output as any;
  console.log(`  ${c.b}${w.city}${c.r}: ${w.temperature}°C, ${w.conditions}`);
}

// Scenario 3: Flight search
console.log(`\n${c.b}${c.cyan}━━━ 3. Flight Search ━━━${c.r}\n`);
const flightResult = await client.task(discovered.find((a) => a.name === 'FlightFinder')!.agentId, 'search-flights', { origin: 'SFO', destination: 'NRT', date: '2026-05-01' });
const flights = (flightResult.output as any).flights;
console.log(`  ${c.b}SFO → NRT${c.r} (${flights.length} flights found):\n`);
for (const f of flights.slice(0, 3)) {
  console.log(`    ${f.airline} ${f.flightNumber}  $${f.price}  ${f.duration}`);
}

// Scenario 4: Code review
console.log(`\n${c.b}${c.cyan}━━━ 4. Code Review ━━━${c.r}\n`);
const codeResult = await client.task(discovered.find((a) => a.name === 'CodeReviewer')!.agentId, 'review-code', {
  code: `function getData() {\n  var data: any = eval(input);\n  console.log(data);\n  return data;\n}`,
  language: 'typescript',
});
const review = codeResult.output as any;
console.log(`  Score: ${review.score >= 70 ? c.green : review.score >= 40 ? c.yellow : c.red}${review.score}/100${c.r}  ${review.summary}`);
for (const issue of review.issues) {
  const icon = issue.severity === 'error' ? `${c.red}✖` : issue.severity === 'warning' ? `${c.yellow}⚠` : `${c.blue}ℹ`;
  console.log(`    ${icon}${c.r} ${issue.message}${issue.suggestion ? ` → ${c.d}${issue.suggestion}${c.r}` : ''}`);
}

// Scenario 5: Research
console.log(`\n${c.b}${c.cyan}━━━ 5. Research ━━━${c.r}\n`);
const researchResult = await client.task(discovered.find((a) => a.name === 'ResearchAssistant')!.agentId, 'research-topic', { topic: 'AI agents', depth: 'brief' });
const research = researchResult.output as any;
console.log(`  ${c.d}${research.summary}${c.r}\n`);
for (const finding of research.keyFindings) {
  console.log(`    • ${finding}`);
}

// Scenario 6: Price tracking
console.log(`\n${c.b}${c.cyan}━━━ 6. Price Comparison ━━━${c.r}\n`);
const priceResult = await client.task(discovered.find((a) => a.name === 'PriceTracker')!.agentId, 'track-price', { product: 'Mechanical Keyboard' });
const prices = priceResult.output as any;
console.log(`  ${c.b}${prices.product}${c.r} — lowest: ${c.green}$${prices.lowestPrice}${c.r}\n`);
for (const r of prices.results) {
  console.log(`    ${r.store.padEnd(12)} $${r.price.toFixed(2).padStart(7)}  ${r.inStock ? `${c.green}In Stock${c.r}` : `${c.red}Out of Stock${c.r}`}`);
}

// Scenario 7: News
console.log(`\n${c.b}${c.cyan}━━━ 7. News Summary ━━━${c.r}\n`);
const newsResult = await client.task(discovered.find((a) => a.name === 'NewsSummarizer')!.agentId, 'summarize-news', { topic: 'AI agents' });
const news = newsResult.output as any;
for (const article of news.articles) {
  const sentColor = article.sentiment === 'positive' ? c.green : article.sentiment === 'negative' ? c.red : c.d;
  console.log(`  ${sentColor}[${article.sentiment}]${c.r} ${article.title} — ${c.d}${article.source}${c.r}`);
}

// Scenario 8: Multi-Agent Orchestration (the showstopper)
console.log(`\n${c.b}${c.cyan}━━━ 8. Multi-Agent Orchestration ━━━${c.r}`);
console.log(`  ${c.d}"Plan a trip to Tokyo" → Orchestrator discovers and delegates to other agents${c.r}\n`);
const tripResult = await client.task(discovered.find((a) => a.name === 'Orchestrator')!.agentId, 'plan-trip', { destination: 'Tokyo', language: 'ja' });
const trip = tripResult.output as any;
console.log(`  ${c.b}Trip to ${trip.destination}${c.r} (${trip.totalDurationMs}ms, ${trip.agentsUsed.length} agents used)\n`);
if (trip.weather) console.log(`  Weather: ${trip.weather.temperature}°C, ${trip.weather.conditions}`);
if (trip.flights?.flights) {
  console.log(`  Cheapest flight: ${trip.flights.flights[0].airline} — $${trip.flights.flights[0].price}`);
}
if (trip.phrases?.length) {
  console.log(`  Useful phrases:`);
  for (const p of trip.phrases) console.log(`    "${p.original}" → "${p.translated}"`);
}
console.log(`  Agents used: ${trip.agentsUsed.join(', ')}`);

// Stats
console.log(`\n${c.b}${c.cyan}━━━ Network Stats ━━━${c.r}\n`);
const statsRes = await fetch(`${REGISTRY}/v1/stats`);
const stats = await statsRes.json() as any;
console.log(`  Agents online: ${c.b}${stats.agents.online}${c.r}`);
console.log(`  Capabilities:  ${c.b}${stats.capabilities}${c.r}`);

console.log(`\n${c.b}${c.green}Demo complete!${c.r} All ${agents.length} agents are running.`);
console.log(`  Registry:  http://localhost:4200`);
console.log(`  Dashboard: http://localhost:3000 (start separately)`);
console.log(`\n  ${c.d}Press Ctrl+C to stop.${c.r}\n`);

await client.close();

process.on('SIGINT', async () => {
  console.log(`\n${c.d}Shutting down ${agents.length} agents...${c.r}`);
  for (const a of agents) await a.stop();
  registry.close();
  process.exit(0);
});
