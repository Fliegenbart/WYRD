import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

// WMO Weather Codes → human-readable conditions
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
  55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

// City → lat/lon lookup
const CITIES: Record<string, { lat: number; lon: number }> = {
  'tokyo': { lat: 35.6762, lon: 139.6503 },
  'new york': { lat: 40.7128, lon: -74.006 },
  'london': { lat: 51.5074, lon: -0.1278 },
  'paris': { lat: 48.8566, lon: 2.3522 },
  'berlin': { lat: 52.52, lon: 13.405 },
  'sydney': { lat: -33.8688, lon: 151.2093 },
  'san francisco': { lat: 37.7749, lon: -122.4194 },
  'mumbai': { lat: 19.076, lon: 72.8777 },
  'dubai': { lat: 25.2048, lon: 55.2708 },
  'são paulo': { lat: -23.5505, lon: -46.6333 },
  'beijing': { lat: 39.9042, lon: 116.4074 },
  'moscow': { lat: 55.7558, lon: 37.6173 },
  'toronto': { lat: 43.6532, lon: -79.3832 },
  'seoul': { lat: 37.5665, lon: 126.978 },
  'bangkok': { lat: 13.7563, lon: 100.5018 },
  'istanbul': { lat: 41.0082, lon: 28.9784 },
  'rome': { lat: 41.9028, lon: 12.4964 },
  'amsterdam': { lat: 52.3676, lon: 4.9041 },
  'singapore': { lat: 1.3521, lon: 103.8198 },
  'los angeles': { lat: 34.0522, lon: -118.2437 },
};

const getWeather = defineCapability({
  id: 'get-weather',
  name: 'Weather Forecast',
  description: 'Get real-time weather conditions for any city (powered by Open-Meteo)',
  tags: ['weather', 'forecast', 'temperature', 'real-time'],
  input: z.object({
    city: z.string().describe('City name'),
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
    source: z.string(),
  }),
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(20, `Looking up coordinates for ${input.city}...`);

    const key = input.city.toLowerCase();
    const coords = CITIES[key];
    if (!coords) {
      // Try geocoding via Open-Meteo
      ctx.progress(30, `Geocoding ${input.city}...`);
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.city)}&count=1`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json() as any;
      if (!geoData.results?.length) {
        throw new Error(`City not found: ${input.city}`);
      }
      const { latitude, longitude } = geoData.results[0];
      return await fetchWeather(input.city, latitude, longitude, input.units, ctx);
    }

    return await fetchWeather(input.city, coords.lat, coords.lon, input.units, ctx);
  },
});

async function fetchWeather(
  city: string, lat: number, lon: number,
  units: 'celsius' | 'fahrenheit',
  ctx: { progress: (pct: number, msg: string) => void },
) {
  ctx.progress(50, 'Fetching weather data from Open-Meteo...');

  const tempUnit = units === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=${tempUnit}&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);
  const data = await res.json() as any;

  ctx.progress(90, 'Formatting results...');

  const current = data.current;
  const windDir = degreeToDirection(current.wind_direction_10m);

  return {
    city,
    temperature: Math.round(current.temperature_2m * 10) / 10,
    units,
    conditions: WMO_CODES[current.weather_code] ?? `WMO ${current.weather_code}`,
    humidity: current.relative_humidity_2m,
    wind: `${current.wind_speed_10m} km/h ${windDir}`,
    timestamp: current.time,
    source: 'Open-Meteo (open-meteo.com)',
  };
}

function degreeToDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';
const port = Number(process.env['PORT'] ?? 4211);

const agent = new Agent({
  name: 'WeatherBot',
  description: 'Real-time weather forecasts powered by Open-Meteo (no API key required)',
  capabilities: [getWeather],
  registry: registryUrl,
  port,
});

agent.on('started', ({ id }) => {
  console.log(`🌤️  WeatherBot online (real API)`);
  console.log(`   ID: ${id}`);
  console.log(`   Port: ${port}`);
  console.log(`   Data: Open-Meteo (open-meteo.com)`);
});

agent.on('task:start', ({ taskId, capabilityId }) => {
  console.log(`   📋 Task ${taskId.slice(0, 8)}... → ${capabilityId}`);
});

agent.on('task:complete', ({ taskId, durationMs }) => {
  console.log(`   ✅ Task ${taskId.slice(0, 8)}... done in ${durationMs}ms`);
});

agent.on('error', (err) => { console.error(`   ❌ Error:`, err.message); });
agent.start().catch(console.error);
process.on('SIGINT', async () => { await agent.stop(); process.exit(0); });
