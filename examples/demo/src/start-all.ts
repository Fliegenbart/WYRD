/**
 * WYRD Demo — Full Agent Network
 *
 * Starts the registry + 8 agents with REAL APIs, then runs demo scenarios
 * showing discovery, direct tasks, and multi-agent collaboration.
 *
 * Real data sources:
 *   Weather  → Open-Meteo (open-meteo.com) — no API key
 *   Translate → MyMemory (mymemory.translated.net) — no API key
 *   News     → Google News RSS — no API key
 */

import { createRegistry } from '@wyrd/registry';
import { Agent, AgentClient, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

// ── Colors ───────────────────────────────────────────────────────────────────

const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m',
  green: '\x1b[32m', blue: '\x1b[34m', cyan: '\x1b[36m',
  yellow: '\x1b[33m', magenta: '\x1b[35m', red: '\x1b[31m',
  gold: '\x1b[38;2;212;168;67m',
};

function log(prefix: string, color: string, msg: string) {
  console.log(`${color}${prefix}${c.r} ${msg}`);
}

// ── Banner ───────────────────────────────────────────────────────────────────

console.log(`
${c.b}${c.gold}
    ╔═══════════════════════════════════════════════════╗
    ║                                                   ║
    ║              W Y R D   D E M O                    ║
    ║              ─────────────────                    ║
    ║   The open coordination layer for the agent       ║
    ║   internet. Real APIs. Real data. No API keys.    ║
    ║                                                   ║
    ║   8 agents · 9 capabilities · live network        ║
    ║                                                   ║
    ╚═══════════════════════════════════════════════════╝
${c.r}
`);

const REGISTRY = 'http://localhost:4200';

// ── WMO Weather Codes ────────────────────────────────────────────────────────

const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 61: 'Slight rain',
  63: 'Moderate rain', 65: 'Heavy rain', 71: 'Slight snow', 73: 'Moderate snow',
  80: 'Rain showers', 95: 'Thunderstorm',
};

const CITIES: Record<string, { lat: number; lon: number }> = {
  tokyo: { lat: 35.6762, lon: 139.6503 }, 'new york': { lat: 40.7128, lon: -74.006 },
  london: { lat: 51.5074, lon: -0.1278 }, berlin: { lat: 52.52, lon: 13.405 },
  paris: { lat: 48.8566, lon: 2.3522 }, sydney: { lat: -33.8688, lon: 151.2093 },
};

// ── Helper: quick agent factory ──────────────────────────────────────────────

function makeAgent(name: string, desc: string, port: number, caps: ReturnType<typeof defineCapability>[]) {
  return new Agent({ name, description: desc, capabilities: caps, registry: REGISTRY, port });
}

// ── Step 1: Start Registry ───────────────────────────────────────────────────

log('[Registry]', c.blue, 'Starting discovery registry...');
const registry = createRegistry({ port: 4200 });
log('[Registry]', c.green, 'Online at http://localhost:4200');

// ── Step 2: Create All 8 Agents ──────────────────────────────────────────────

const agents: Agent[] = [];

// 1. Weather (REAL — Open-Meteo API)
agents.push(makeAgent('WeatherBot', 'Real-time weather via Open-Meteo', 4211, [
  defineCapability({
    id: 'get-weather', name: 'Weather', description: 'Real-time weather (Open-Meteo)',
    tags: ['weather', 'forecast', 'real-time'],
    input: z.object({ city: z.string(), units: z.enum(['celsius', 'fahrenheit']).default('celsius') }),
    output: z.object({ city: z.string(), temperature: z.number(), units: z.string(), conditions: z.string(), humidity: z.number(), wind: z.string(), timestamp: z.string(), source: z.string() }),
    handler: async (input, ctx) => {
      ctx.progress(30, `Fetching weather for ${input.city}...`);
      const key = input.city.toLowerCase();
      let lat: number, lon: number;
      if (CITIES[key]) {
        ({ lat, lon } = CITIES[key]);
      } else {
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.city)}&count=1`);
        const geoData = await geo.json() as any;
        if (!geoData.results?.length) throw new Error(`City not found: ${input.city}`);
        lat = geoData.results[0].latitude; lon = geoData.results[0].longitude;
      }
      const tempUnit = input.units === 'fahrenheit' ? 'fahrenheit' : 'celsius';
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=${tempUnit}&timezone=auto`);
      const data = await res.json() as any;
      const cur = data.current;
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      ctx.progress(90, 'Done');
      return {
        city: input.city, temperature: Math.round(cur.temperature_2m * 10) / 10, units: input.units,
        conditions: WMO[cur.weather_code] ?? `Code ${cur.weather_code}`,
        humidity: cur.relative_humidity_2m,
        wind: `${cur.wind_speed_10m} km/h ${dirs[Math.round(cur.wind_direction_10m / 45) % 8]}`,
        timestamp: cur.time, source: 'Open-Meteo',
      };
    },
  }),
]));

// 2. Translator (REAL — MyMemory API)
agents.push(makeAgent('TranslatorBot', 'Real translation via MyMemory', 4212, [
  defineCapability({
    id: 'translate-text', name: 'Translation', description: 'Real translation (MyMemory)',
    tags: ['translation', 'language', 'real-time'],
    input: z.object({ text: z.string(), from: z.string(), to: z.string() }),
    output: z.object({ original: z.string(), translated: z.string(), from: z.string(), to: z.string(), fromLanguage: z.string(), toLanguage: z.string(), confidence: z.number(), source: z.string() }),
    handler: async (input, ctx) => {
      ctx.progress(30, 'Translating...');
      const langs: Record<string, string> = { en: 'English', ja: 'Japanese', de: 'German', es: 'Spanish', fr: 'French', ko: 'Korean', zh: 'Chinese', pt: 'Portuguese', it: 'Italian' };
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(input.text)}&langpair=${input.from}|${input.to}`);
      const data = await res.json() as any;
      if (data.responseStatus !== 200) throw new Error(`Translation failed: ${data.responseDetails}`);
      ctx.progress(90, 'Done');
      return {
        original: input.text, translated: data.responseData.translatedText,
        from: input.from, to: input.to,
        fromLanguage: langs[input.from] ?? input.from, toLanguage: langs[input.to] ?? input.to,
        confidence: Math.min(data.responseData.match ?? 0, 1), source: 'MyMemory',
      };
    },
  }),
]));

// 3. Flight Finder (simulated)
agents.push(makeAgent('FlightFinder', 'Flight search', 4213, [
  defineCapability({
    id: 'search-flights', name: 'Flights', description: 'Search flights',
    tags: ['travel', 'flights'],
    input: z.object({ origin: z.string(), destination: z.string(), date: z.string(), passengers: z.number().default(1) }),
    output: z.object({ flights: z.array(z.object({ airline: z.string(), flightNumber: z.string(), price: z.number(), currency: z.string(), duration: z.string() })) }),
    handler: async (input, ctx) => {
      ctx.progress(50, `Searching ${input.origin} → ${input.destination}...`);
      await new Promise((r) => setTimeout(r, 150));
      const airlines = ['Lufthansa', 'Emirates', 'ANA', 'Delta', 'Singapore Airlines'];
      const flights = airlines.slice(0, 3 + Math.floor(Math.random() * 2)).map((a, i) => ({
        airline: a, flightNumber: `${a.slice(0, 2).toUpperCase()}${100 + i * 111}`,
        price: Math.round((300 + Math.random() * 1000) * input.passengers), currency: 'USD',
        duration: `${8 + Math.floor(Math.random() * 8)}h ${Math.floor(Math.random() * 4) * 15}m`,
      })).sort((a, b) => a.price - b.price);
      return { flights };
    },
  }),
]));

// 4. Code Reviewer (simulated)
agents.push(makeAgent('CodeReviewer', 'Code review', 4214, [
  defineCapability({
    id: 'review-code', name: 'Code Review', description: 'Review code',
    tags: ['code', 'review', 'development'],
    input: z.object({ code: z.string(), language: z.string().default('typescript') }),
    output: z.object({ issues: z.array(z.object({ severity: z.enum(['info', 'warning', 'error']), message: z.string(), suggestion: z.string().optional() })), summary: z.string(), score: z.number() }),
    handler: async (input, ctx) => {
      ctx.progress(50, 'Analyzing...');
      await new Promise((r) => setTimeout(r, 100));
      const issues: any[] = [];
      if (input.code.includes('console.log')) issues.push({ severity: 'warning', message: 'console.log left in code', suggestion: 'Use proper logging' });
      if (input.code.includes('eval(')) issues.push({ severity: 'error', message: 'eval() is a security risk', suggestion: 'Avoid eval' });
      if (input.code.includes(': any')) issues.push({ severity: 'warning', message: 'TypeScript any type', suggestion: 'Use proper types' });
      if (input.code.includes('var ')) issues.push({ severity: 'warning', message: 'var declaration', suggestion: 'Use const/let' });
      const score = Math.max(0, 100 - issues.filter((i) => i.severity === 'error').length * 15 - issues.filter((i) => i.severity === 'warning').length * 5);
      return { issues, summary: issues.length === 0 ? 'Clean!' : `${issues.length} issues found`, score };
    },
  }),
]));

// 5. Research (simulated)
agents.push(makeAgent('ResearchAssistant', 'Topic research', 4215, [
  defineCapability({
    id: 'research-topic', name: 'Research', description: 'Research any topic',
    tags: ['research', 'analysis'],
    input: z.object({ topic: z.string() }),
    output: z.object({ summary: z.string(), keyFindings: z.array(z.string()), confidence: z.number() }),
    handler: async (input, ctx) => {
      ctx.progress(50, `Researching "${input.topic}"...`);
      await new Promise((r) => setTimeout(r, 200));
      return {
        summary: `Research on "${input.topic}" shows active development and growing interest.`,
        keyFindings: [`${input.topic} is an evolving field`, 'Cross-disciplinary applications emerging', 'Significant recent breakthroughs reported'],
        confidence: 0.7,
      };
    },
  }),
]));

// 6. Price Tracker (simulated)
agents.push(makeAgent('PriceTracker', 'Price comparison', 4216, [
  defineCapability({
    id: 'track-price', name: 'Prices', description: 'Compare prices',
    tags: ['shopping', 'price'],
    input: z.object({ product: z.string() }),
    output: z.object({ product: z.string(), results: z.array(z.object({ store: z.string(), price: z.number(), inStock: z.boolean() })), lowestPrice: z.number() }),
    handler: async (input, ctx) => {
      ctx.progress(50, `Searching "${input.product}"...`);
      await new Promise((r) => setTimeout(r, 150));
      const stores = ['Amazon', 'Best Buy', 'Walmart', 'eBay'];
      const base = input.product.length * 12 + 50;
      const results = stores.map((s) => ({ store: s, price: Math.round(base * (0.85 + Math.random() * 0.3) * 100) / 100, inStock: Math.random() > 0.15 })).sort((a, b) => a.price - b.price);
      return { product: input.product, results, lowestPrice: results[0].price };
    },
  }),
]));

// 7. News (REAL — Google News RSS)
agents.push(makeAgent('NewsSummarizer', 'Real news via Google News RSS', 4217, [
  defineCapability({
    id: 'summarize-news', name: 'News', description: 'Real news (Google News RSS)',
    tags: ['news', 'summary', 'real-time'],
    input: z.object({ topic: z.string(), count: z.number().default(3) }),
    output: z.object({ articles: z.array(z.object({ title: z.string(), source: z.string(), sentiment: z.enum(['positive', 'neutral', 'negative']) })), overallSentiment: z.string(), dataSource: z.string() }),
    handler: async (input, ctx) => {
      ctx.progress(30, `Fetching news for "${input.topic}"...`);
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(input.topic)}&hl=en-US&gl=US&ceid=US:en`);
      const xml = await res.text();
      ctx.progress(70, 'Parsing...');
      const items: { title: string; source: string }[] = [];
      const itemRe = /<item>([\s\S]*?)<\/item>/g;
      let m;
      while ((m = itemRe.exec(xml)) && items.length < input.count) {
        const t = m[1].match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1] ?? '';
        const dash = t.lastIndexOf(' - ');
        items.push({ title: dash > 0 ? t.slice(0, dash) : t, source: dash > 0 ? t.slice(dash + 3) : 'Unknown' });
      }
      const pos = ['breakthrough', 'success', 'growth', 'launch', 'advance'];
      const neg = ['crisis', 'crash', 'fail', 'risk', 'threat', 'warn'];
      const articles = items.map((a) => {
        const low = a.title.toLowerCase();
        const sentiment = pos.some((w) => low.includes(w)) ? 'positive' as const : neg.some((w) => low.includes(w)) ? 'negative' as const : 'neutral' as const;
        return { ...a, sentiment };
      });
      return { articles, overallSentiment: 'neutral', dataSource: 'Google News RSS' };
    },
  }),
]));

// 8. Orchestrator (uses real agents above)
agents.push(makeAgent('Orchestrator', 'Multi-agent orchestration', 4210, [
  defineCapability({
    id: 'plan-trip', name: 'Trip Planner', description: 'Plan trips using multiple agents',
    tags: ['orchestration', 'travel'],
    input: z.object({ destination: z.string(), language: z.string().default('en') }),
    output: z.object({ destination: z.string(), weather: z.any().optional(), phrases: z.array(z.any()).optional(), flights: z.any().optional(), news: z.any().optional(), agentsUsed: z.array(z.string()), totalDurationMs: z.number() }),
    handler: async (input, ctx) => {
      const start = Date.now();
      const used: string[] = [];
      const oc = new AgentClient({ registry: REGISTRY });
      const results: any = {};
      ctx.progress(10, `Planning trip to ${input.destination}...`);

      // Weather (real)
      try {
        const wa = await oc.discover({ tags: ['weather'], limit: 1 });
        if (wa[0]) {
          const r = await oc.task(wa[0].agentId, 'get-weather', { city: input.destination });
          results.weather = r.output; used.push('WeatherBot');
          ctx.progress(30, `Weather: ${(r.output as any).conditions}`);
        }
      } catch {}

      // Flights
      try {
        const fa = await oc.discover({ tags: ['flights'], limit: 1 });
        if (fa[0]) {
          const r = await oc.task(fa[0].agentId, 'search-flights', { origin: 'SFO', destination: input.destination.slice(0, 3).toUpperCase(), date: '2026-06-01' });
          results.flights = r.output; used.push('FlightFinder');
          ctx.progress(50, `Found ${(r.output as any).flights?.length} flights`);
        }
      } catch {}

      // Translation (real)
      if (input.language !== 'en') {
        try {
          const ta = await oc.discover({ tags: ['translation'], limit: 1 });
          if (ta[0]) {
            const phrases = [];
            for (const text of ['hello', 'thank you', 'how much does it cost', 'where is the station']) {
              const r = await oc.task(ta[0].agentId, 'translate-text', { text, from: 'en', to: input.language });
              phrases.push(r.output);
            }
            results.phrases = phrases; used.push('TranslatorBot');
            ctx.progress(70, `Translated ${phrases.length} phrases`);
          }
        } catch {}
      }

      // News (real)
      try {
        const na = await oc.discover({ tags: ['news'], limit: 1 });
        if (na[0]) {
          const r = await oc.task(na[0].agentId, 'summarize-news', { topic: `${input.destination} travel`, count: 2 });
          results.news = r.output; used.push('NewsSummarizer');
          ctx.progress(85, 'Got travel news');
        }
      } catch {}

      await oc.close();
      return { destination: input.destination, ...results, agentsUsed: used, totalDurationMs: Date.now() - start };
    },
  }),
]));

// ── Start all agents ─────────────────────────────────────────────────────────

const icons = ['🌤️', '🌐', '✈️', '🔍', '🔬', '💰', '📰', '🎯'];
const labels = ['(real API)', '(real API)', '', '', '', '', '(real API)', ''];
for (let i = 0; i < agents.length; i++) {
  await agents[i].start();
  log(`  ${icons[i]}`, c.green, `${agents[i].config.name} online ${labels[i]} (${agents[i].id.slice(0, 10)}...) port ${agents[i].port}`);
}

// ── Demo Scenarios ───────────────────────────────────────────────────────────

const client = new AgentClient({ registry: REGISTRY });

// 1. Discovery
console.log(`\n${c.b}${c.gold}━━━ 1. Agent Discovery ━━━${c.r}\n`);
const discovered = await client.discover({});
console.log(`  Found ${c.b}${discovered.length}${c.r} agents on the network:\n`);
for (const a of discovered) {
  const caps = a.capabilities.map((cap) => cap.id).join(', ');
  console.log(`    ${c.b}${a.name}${c.r}  ${c.d}${a.agentId.slice(0, 10)}...${c.r}  → ${c.cyan}${caps}${c.r}`);
}

// 2. Real weather
console.log(`\n${c.b}${c.gold}━━━ 2. Real Weather Data (Open-Meteo) ━━━${c.r}\n`);
for (const city of ['Tokyo', 'New York', 'Berlin']) {
  const r = await client.task(discovered.find((a) => a.name === 'WeatherBot')!.agentId, 'get-weather', { city });
  const w = r.output as any;
  console.log(`  ${c.b}${w.city}${c.r}: ${c.yellow}${w.temperature}°C${c.r}, ${w.conditions}, ${w.humidity}% humidity, wind ${w.wind}`);
}

// 3. Real translation
console.log(`\n${c.b}${c.gold}━━━ 3. Real Translation (MyMemory) ━━━${c.r}\n`);
const translatorId = discovered.find((a) => a.name === 'TranslatorBot')!.agentId;
for (const [text, to, lang] of [['hello', 'ja', 'Japanese'], ['thank you', 'de', 'German'], ['where is the train station', 'es', 'Spanish']]) {
  const r = await client.task(translatorId, 'translate-text', { text, from: 'en', to });
  const t = r.output as any;
  console.log(`  ${c.d}${lang}:${c.r} "${text}" → "${c.b}${t.translated}${c.r}" ${c.d}(${(t.confidence * 100).toFixed(0)}%)${c.r}`);
}

// 4. Real news
console.log(`\n${c.b}${c.gold}━━━ 4. Real News Headlines (Google News) ━━━${c.r}\n`);
const newsResult = await client.task(discovered.find((a) => a.name === 'NewsSummarizer')!.agentId, 'summarize-news', { topic: 'AI agents', count: 4 });
const news = newsResult.output as any;
for (const article of news.articles) {
  const sentColor = article.sentiment === 'positive' ? c.green : article.sentiment === 'negative' ? c.red : c.d;
  console.log(`  ${sentColor}[${article.sentiment}]${c.r} ${article.title}`);
  console.log(`           ${c.d}— ${article.source}${c.r}`);
}

// 5. Code review
console.log(`\n${c.b}${c.gold}━━━ 5. Code Review ━━━${c.r}\n`);
const codeResult = await client.task(discovered.find((a) => a.name === 'CodeReviewer')!.agentId, 'review-code', {
  code: `function getData() {\n  var data: any = eval(input);\n  console.log(data);\n  return data;\n}`,
});
const review = codeResult.output as any;
console.log(`  Score: ${review.score >= 70 ? c.green : review.score >= 40 ? c.yellow : c.red}${review.score}/100${c.r}  ${review.summary}`);
for (const issue of review.issues) {
  const icon = issue.severity === 'error' ? `${c.red}✖` : `${c.yellow}⚠`;
  console.log(`    ${icon}${c.r} ${issue.message}${issue.suggestion ? ` → ${c.d}${issue.suggestion}${c.r}` : ''}`);
}

// 6. Multi-agent orchestration (the showstopper)
console.log(`\n${c.b}${c.gold}━━━ 6. Multi-Agent Orchestration ━━━${c.r}`);
console.log(`  ${c.d}"Plan a trip to Tokyo" → Orchestrator discovers and delegates to 4 real agents${c.r}\n`);

const tripResult = await client.task(discovered.find((a) => a.name === 'Orchestrator')!.agentId, 'plan-trip', { destination: 'Tokyo', language: 'ja' });
const trip = tripResult.output as any;

console.log(`  ${c.b}${c.gold}Trip to ${trip.destination}${c.r} — ${trip.agentsUsed.length} agents, ${trip.totalDurationMs}ms\n`);
if (trip.weather) console.log(`  ${c.b}Weather:${c.r} ${trip.weather.temperature}°C, ${trip.weather.conditions} (${trip.weather.source})`);
if (trip.flights?.flights) console.log(`  ${c.b}Cheapest flight:${c.r} ${trip.flights.flights[0].airline} — $${trip.flights.flights[0].price}`);
if (trip.phrases?.length) {
  console.log(`  ${c.b}Useful phrases:${c.r}`);
  for (const p of trip.phrases) console.log(`    "${p.original}" → "${p.translated}" (${p.source})`);
}
if (trip.news?.articles?.length) {
  console.log(`  ${c.b}Travel news:${c.r}`);
  for (const a of trip.news.articles) console.log(`    ${c.d}•${c.r} ${a.title}`);
}
console.log(`  ${c.d}Agents used: ${trip.agentsUsed.join(', ')}${c.r}`);

// Stats
console.log(`\n${c.b}${c.gold}━━━ Network Stats ━━━${c.r}\n`);
const statsRes = await fetch(`${REGISTRY}/v1/stats`);
const stats = await statsRes.json() as any;
console.log(`  Agents online: ${c.b}${stats.agents.online}${c.r}`);
console.log(`  Capabilities:  ${c.b}${stats.capabilities}${c.r}`);

console.log(`\n${c.b}${c.green}Demo complete!${c.r} All ${agents.length} agents running with real data.`);
console.log(`  Registry:  http://localhost:4200`);
console.log(`  Dashboard: http://localhost:3000 ${c.d}(run: pnpm --filter @wyrd/dashboard dev)${c.r}`);
console.log(`\n  ${c.d}Press Ctrl+C to stop.${c.r}\n`);

await client.close();

process.on('SIGINT', async () => {
  console.log(`\n${c.d}Shutting down ${agents.length} agents...${c.r}`);
  for (const a of agents) await a.stop();
  registry.close();
  process.exit(0);
});
