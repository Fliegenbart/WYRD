/**
 * AgentNet Demo — Start Everything
 *
 * This script starts the registry + all example agents in a single process,
 * then runs a demo scenario showing multi-agent collaboration.
 */

import { createRegistry } from '@agentnet/registry';
import { Agent, AgentClient, defineCapability } from '@agentnet/sdk';
import { z } from 'zod';

// ── Colors for terminal output ───────────────────────────────────────────────

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function log(prefix: string, color: string, msg: string) {
  console.log(`${color}${prefix}${colors.reset} ${msg}`);
}

// ── Banner ───────────────────────────────────────────────────────────────────

console.log(`
${colors.bold}${colors.cyan}
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║          A G E N T N E T   D E M O                    ║
    ║                                                       ║
    ║   The open protocol for agent-to-agent communication  ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
${colors.reset}
`);

// ── Step 1: Start Registry ───────────────────────────────────────────────────

log('[Registry]', colors.blue, 'Starting discovery registry on port 4200...');
const registry = createRegistry({ port: 4200 });
log('[Registry]', colors.green, 'Registry online at http://localhost:4200');

// ── Step 2: Create Agents ────────────────────────────────────────────────────

// Weather Agent
const weatherAgent = new Agent({
  name: 'WeatherBot',
  description: 'Weather forecasts for cities worldwide',
  port: 4211,
  registry: 'http://localhost:4200',
  capabilities: [
    defineCapability({
      id: 'get-weather',
      name: 'Weather Forecast',
      description: 'Get current weather for a city',
      tags: ['weather', 'forecast'],
      input: z.object({
        city: z.string(),
        units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
      }),
      output: z.object({
        city: z.string(),
        temperature: z.number(),
        units: z.string(),
        conditions: z.string(),
        humidity: z.number(),
        wind: z.string(),
        timestamp: z.string(),
      }),
      handler: async (input, ctx) => {
        ctx.progress(50, `Checking weather for ${input.city}...`);
        await new Promise((r) => setTimeout(r, 200));
        const temps: Record<string, number> = { tokyo: 18, 'new york': 22, london: 14, berlin: 12, paris: 16 };
        const conds: Record<string, string> = { tokyo: 'Partly Cloudy', 'new york': 'Sunny', london: 'Rainy', berlin: 'Cloudy', paris: 'Overcast' };
        const key = input.city.toLowerCase();
        const temp = temps[key] ?? Math.round(15 + Math.random() * 15);
        return {
          city: input.city,
          temperature: input.units === 'fahrenheit' ? Math.round(temp * 9/5 + 32) : temp,
          units: input.units,
          conditions: conds[key] ?? 'Clear',
          humidity: 65,
          wind: '12 km/h',
          timestamp: new Date().toISOString(),
        };
      },
    }),
  ],
});

// Translator Agent
const translatorAgent = new Agent({
  name: 'TranslatorBot',
  description: 'Translates text between languages',
  port: 4212,
  registry: 'http://localhost:4200',
  capabilities: [
    defineCapability({
      id: 'translate-text',
      name: 'Text Translation',
      description: 'Translate text between languages',
      tags: ['translation', 'language'],
      input: z.object({
        text: z.string(),
        from: z.string(),
        to: z.string(),
      }),
      output: z.object({
        original: z.string(),
        translated: z.string(),
        from: z.string(),
        to: z.string(),
        fromLanguage: z.string(),
        toLanguage: z.string(),
        confidence: z.number(),
      }),
      handler: async (input, ctx) => {
        ctx.progress(50, 'Translating...');
        await new Promise((r) => setTimeout(r, 100));
        const dict: Record<string, Record<string, string>> = {
          'en→ja': { hello: 'こんにちは', 'thank you': 'ありがとう', goodbye: 'さようなら', please: 'お願いします', 'how are you': 'お元気ですか' },
          'en→de': { hello: 'Hallo', 'thank you': 'Danke', goodbye: 'Auf Wiedersehen', please: 'Bitte', 'how are you': 'Wie geht es Ihnen' },
          'en→es': { hello: 'Hola', 'thank you': 'Gracias', goodbye: 'Adiós', please: 'Por favor', 'how are you': '¿Cómo estás?' },
        };
        const key = `${input.from}→${input.to}`;
        const langs: Record<string, string> = { en: 'English', ja: 'Japanese', de: 'German', es: 'Spanish', fr: 'French' };
        const translated = dict[key]?.[input.text.toLowerCase()] ?? `[${input.to}] ${input.text}`;
        return {
          original: input.text,
          translated,
          from: input.from,
          to: input.to,
          fromLanguage: langs[input.from] ?? input.from,
          toLanguage: langs[input.to] ?? input.to,
          confidence: dict[key]?.[input.text.toLowerCase()] ? 0.98 : 0.3,
        };
      },
    }),
  ],
});

// ── Step 3: Start All Agents ─────────────────────────────────────────────────

log('[Weather]', colors.yellow, 'Starting WeatherBot...');
await weatherAgent.start();
log('[Weather]', colors.green, `WeatherBot online (${weatherAgent.id.slice(0, 12)}...) on port 4211`);

log('[Translator]', colors.magenta, 'Starting TranslatorBot...');
await translatorAgent.start();
log('[Translator]', colors.green, `TranslatorBot online (${translatorAgent.id.slice(0, 12)}...) on port 4212`);

// ── Step 4: Demo Scenarios ───────────────────────────────────────────────────

console.log(`\n${colors.bold}${colors.cyan}━━━ Demo: Agent Discovery & Collaboration ━━━${colors.reset}\n`);

const client = new AgentClient({ registry: 'http://localhost:4200' });

// Demo 1: Discover all agents
log('[Demo]', colors.cyan, 'Discovering all agents on the network...');
const allAgents = await client.discover({});
console.log(`\n  Found ${allAgents.length} agents:`);
for (const a of allAgents) {
  const caps = a.capabilities.map((c) => c.id).join(', ');
  console.log(`    ${colors.bold}${a.name ?? 'Unknown'}${colors.reset} (${a.agentId.slice(0, 12)}...) — capabilities: ${caps}`);
}

// Demo 2: Direct task — get weather
console.log(`\n${colors.bold}${colors.cyan}━━━ Demo: Direct Agent Task ━━━${colors.reset}\n`);
log('[Demo]', colors.cyan, 'Asking WeatherBot for Tokyo weather...');

const weatherResult = await client.task(allAgents.find((a) => a.name === 'WeatherBot')!.agentId, 'get-weather', {
  city: 'Tokyo',
  units: 'celsius',
});

console.log(`\n  ${colors.green}Result:${colors.reset}`);
const w = weatherResult.output as any;
console.log(`    City: ${w.city}`);
console.log(`    Temperature: ${w.temperature}°C`);
console.log(`    Conditions: ${w.conditions}`);
console.log(`    Humidity: ${w.humidity}%`);

// Demo 3: Multi-agent chain — weather + translation
console.log(`\n${colors.bold}${colors.cyan}━━━ Demo: Multi-Agent Collaboration ━━━${colors.reset}\n`);
log('[Demo]', colors.cyan, 'Chain: Get weather for Tokyo → Translate phrases to Japanese...');

const cities = ['Tokyo', 'New York', 'London'];
const phrases = ['hello', 'thank you', 'goodbye'];

for (const city of cities) {
  const wr = await client.task(
    allAgents.find((a) => a.name === 'WeatherBot')!.agentId,
    'get-weather',
    { city, units: 'celsius' },
  );
  const weather = wr.output as any;
  console.log(`\n  ${colors.bold}${city}${colors.reset}: ${weather.temperature}°C, ${weather.conditions}`);
}

console.log(`\n  Useful Japanese phrases:`);
for (const phrase of phrases) {
  const tr = await client.task(
    allAgents.find((a) => a.name === 'TranslatorBot')!.agentId,
    'translate-text',
    { text: phrase, from: 'en', to: 'ja' },
  );
  const t = tr.output as any;
  console.log(`    "${t.original}" → "${t.translated}" (confidence: ${(t.confidence * 100).toFixed(0)}%)`);
}

// Demo 4: Network stats
console.log(`\n${colors.bold}${colors.cyan}━━━ Network Stats ━━━${colors.reset}\n`);
const statsRes = await fetch('http://localhost:4200/v1/stats');
const stats = await statsRes.json() as any;
console.log(`  Agents online: ${stats.agents.online}`);
console.log(`  Total capabilities: ${stats.capabilities}`);

console.log(`\n${colors.bold}${colors.green}Demo complete!${colors.reset} The agent network is still running.`);
console.log(`  Registry: http://localhost:4200`);
console.log(`  Try: curl http://localhost:4200/v1/discover?tags=weather`);
console.log(`\n  Press Ctrl+C to stop all agents.\n`);

// Keep running
await client.close();

process.on('SIGINT', async () => {
  console.log(`\n${colors.dim}Shutting down...${colors.reset}`);
  await weatherAgent.stop();
  await translatorAgent.stop();
  registry.close();
  process.exit(0);
});
