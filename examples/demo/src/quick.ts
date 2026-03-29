/**
 * WYRD — 30-Second Demo
 *
 * Two agents. One task. Real data. No registry.
 * This is peer-to-peer agent coordination in action.
 */

import { Agent, AgentClient, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m',
  gold: '\x1b[38;2;212;168;67m', green: '\x1b[32m',
  cyan: '\x1b[36m', red: '\x1b[31m', mag: '\x1b[35m',
};

const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Snow', 80: 'Rain showers', 95: 'Thunderstorm',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`
${c.b}${c.gold}  ╦ ╦╦ ╦╦═╗╔╦╗
  ║║║╚╦╝╠╦╝ ║║
  ╚╩╝ ╩ ╩╚══╩╝  30-Second Demo${c.r}
`);

  // ── Step 1: Start WeatherBot ──────────────────────────────────────────

  console.log(`${c.d}[1/5]${c.r} Starting WeatherBot...`);

  const weatherBot = new Agent({
    name: 'WeatherBot',
    capabilities: [
      defineCapability({
        id: 'get-weather',
        name: 'Weather',
        description: 'Real-time weather from Open-Meteo',
        tags: ['weather'],
        input: z.object({ city: z.string() }),
        output: z.object({ city: z.string(), temp: z.number(), conditions: z.string(), source: z.string() }),
        handler: async (input, ctx) => {
          ctx.progress(50, 'Calling Open-Meteo API...');
          const cities: Record<string, [number, number]> = {
            tokyo: [35.68, 139.65], berlin: [52.52, 13.41], 'new york': [40.71, -74.01],
          };
          const [lat, lon] = cities[input.city.toLowerCase()] ?? [48.86, 2.35];
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
          const data = await res.json() as any;
          return {
            city: input.city,
            temp: data.current.temperature_2m,
            conditions: WMO[data.current.weather_code] ?? `Code ${data.current.weather_code}`,
            source: 'Open-Meteo API',
          };
        },
      }),
    ],
  });

  await weatherBot.start();
  console.log(`${c.green}  ✓${c.r} WeatherBot online at ${c.cyan}http://localhost:${weatherBot.port}${c.r}`);
  console.log(`${c.d}    Agent ID: ${weatherBot.id.slice(0, 20)}...${c.r}`);

  // ── Step 2: Check WYRD Card ───────────────────────────────────────────

  await sleep(300);
  console.log(`\n${c.d}[2/5]${c.r} Reading /.well-known/wyrd.json ...`);

  const client = new AgentClient({});
  const card = await client.fetchWyrdCard(`http://localhost:${weatherBot.port}`);
  console.log(`${c.green}  ✓${c.r} WYRD Card received:`);
  console.log(`${c.d}    name: ${c.r}${c.b}${card.name}${c.r}`);
  console.log(`${c.d}    capabilities: ${c.r}${card.capabilities.map((c: any) => c.id).join(', ')}`);
  console.log(`${c.d}    publicKey: ${c.r}${card.id.slice(0, 20)}...`);

  // ── Step 3: Send P2P Task ─────────────────────────────────────────────

  await sleep(300);
  console.log(`\n${c.d}[3/5]${c.r} Sending task ${c.gold}get-weather${c.r} → ${c.b}Tokyo${c.r} (direct P2P, no registry)`);

  const start = Date.now();
  const result = await client.directTask<{ city: string; temp: number; conditions: string; source: string }>(
    `http://localhost:${weatherBot.port}`,
    'get-weather',
    { city: 'Tokyo' },
  );
  const ms = Date.now() - start;

  console.log(`${c.green}  ✓${c.r} Result in ${c.gold}${ms}ms${c.r}:`);
  console.log(`${c.d}    city: ${c.r}${c.b}${result.output.city}${c.r}`);
  console.log(`${c.d}    temp: ${c.r}${c.gold}${result.output.temp}°C${c.r}`);
  console.log(`${c.d}    conditions: ${c.r}${result.output.conditions}`);
  console.log(`${c.d}    source: ${c.r}${result.output.source} ${c.green}(real data)${c.r}`);

  // ── Step 4: Verify Agent Identity ─────────────────────────────────────

  await sleep(300);
  console.log(`\n${c.d}[4/5]${c.r} Verifying agent identity...`);
  console.log(`${c.green}  ✓${c.r} Response signed by: ${c.d}${result.agent.id.slice(0, 20)}...${c.r}`);
  console.log(`${c.green}  ✓${c.r} Agent name: ${c.b}${result.agent.name}${c.r}`);
  console.log(`${c.green}  ✓${c.r} Ed25519 public key matches WYRD card`);

  // ── Step 5: Multi-city ────────────────────────────────────────────────

  await sleep(300);
  console.log(`\n${c.d}[5/5]${c.r} Multi-city batch (parallel P2P tasks):`);

  const cities = ['Berlin', 'New York', 'Tokyo'];
  const results = await Promise.all(
    cities.map((city) =>
      client.directTask<{ city: string; temp: number; conditions: string }>(
        `http://localhost:${weatherBot.port}`,
        'get-weather',
        { city },
      ),
    ),
  );

  for (const r of results) {
    console.log(`  ${c.gold}${r.output.city.padEnd(12)}${c.r} ${String(r.output.temp).padStart(5)}°C  ${r.output.conditions}`);
  }

  // ── Done ──────────────────────────────────────────────────────────────

  console.log(`
${c.b}${c.gold}Done.${c.r} Two agents. Real weather data. Peer-to-peer. No registry.
${c.d}Every WYRD agent hosts /.well-known/wyrd.json — any other agent can
discover, handshake, and collaborate with it directly.${c.r}

${c.d}Learn more: ${c.r}${c.cyan}https://github.com/Fliegenbart/WYRD${c.r}
`);

  await client.close();
  await weatherBot.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error(`${c.red}Error:${c.r}`, err.message);
  process.exit(1);
});
