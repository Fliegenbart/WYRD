import { Agent, defineCapability } from '@agentnet/sdk';
import { z } from 'zod';

// Simulated weather data for demo purposes
const WEATHER_DATA: Record<string, { temp: number; conditions: string; humidity: number; wind: string }> = {
  'tokyo': { temp: 18, conditions: 'Partly Cloudy', humidity: 65, wind: '12 km/h NE' },
  'new york': { temp: 22, conditions: 'Sunny', humidity: 45, wind: '8 km/h SW' },
  'london': { temp: 14, conditions: 'Rainy', humidity: 82, wind: '20 km/h W' },
  'paris': { temp: 16, conditions: 'Overcast', humidity: 70, wind: '15 km/h NW' },
  'berlin': { temp: 12, conditions: 'Cloudy', humidity: 75, wind: '18 km/h N' },
  'sydney': { temp: 25, conditions: 'Sunny', humidity: 55, wind: '10 km/h SE' },
  'san francisco': { temp: 17, conditions: 'Foggy', humidity: 78, wind: '14 km/h W' },
  'mumbai': { temp: 32, conditions: 'Hot & Humid', humidity: 88, wind: '6 km/h S' },
  'dubai': { temp: 38, conditions: 'Sunny', humidity: 30, wind: '5 km/h NE' },
  'são paulo': { temp: 24, conditions: 'Thunderstorms', humidity: 80, wind: '22 km/h E' },
};

const getWeather = defineCapability({
  id: 'get-weather',
  name: 'Weather Forecast',
  description: 'Get current weather conditions for a city',
  tags: ['weather', 'forecast', 'temperature'],
  input: z.object({
    city: z.string().describe('City name'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature units'),
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
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(30, `Looking up weather for ${input.city}...`);

    // Simulate API delay
    await new Promise((r) => setTimeout(r, 200));

    const key = input.city.toLowerCase();
    const data = WEATHER_DATA[key];

    ctx.progress(80, 'Formatting results...');

    if (!data) {
      // Generate random weather for unknown cities
      const temp = Math.round(15 + Math.random() * 20);
      const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Clear'][Math.floor(Math.random() * 5)];
      return {
        city: input.city,
        temperature: input.units === 'fahrenheit' ? Math.round(temp * 9 / 5 + 32) : temp,
        units: input.units,
        conditions,
        humidity: Math.round(40 + Math.random() * 50),
        wind: `${Math.round(5 + Math.random() * 20)} km/h`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      city: input.city,
      temperature: input.units === 'fahrenheit' ? Math.round(data.temp * 9 / 5 + 32) : data.temp,
      units: input.units,
      conditions: data.conditions,
      humidity: data.humidity,
      wind: data.wind,
      timestamp: new Date().toISOString(),
    };
  },
});

const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';
const port = Number(process.env['PORT'] ?? 4211);

const agent = new Agent({
  name: 'WeatherBot',
  description: 'Provides weather forecasts for cities worldwide',
  capabilities: [getWeather],
  registry: registryUrl,
  port,
});

agent.on('started', ({ id }) => {
  console.log(`🌤️  WeatherBot online`);
  console.log(`   ID: ${id}`);
  console.log(`   Port: ${port}`);
  console.log(`   Registry: ${registryUrl}`);
});

agent.on('task:start', ({ taskId, capabilityId }) => {
  console.log(`   📋 Task ${taskId.slice(0, 8)}... → ${capabilityId}`);
});

agent.on('task:complete', ({ taskId, durationMs }) => {
  console.log(`   ✅ Task ${taskId.slice(0, 8)}... done in ${durationMs}ms`);
});

agent.on('error', (err) => {
  console.error(`   ❌ Error:`, err.message);
});

agent.start().catch(console.error);

process.on('SIGINT', async () => {
  console.log('\n   Shutting down WeatherBot...');
  await agent.stop();
  process.exit(0);
});
