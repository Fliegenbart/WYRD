import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

const AIRLINES = ['Lufthansa', 'Emirates', 'ANA', 'Delta', 'Singapore Airlines', 'British Airways', 'Air France', 'JAL'];

function randomFlight(origin: string, dest: string, date: string) {
  const airline = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
  const depHour = 6 + Math.floor(Math.random() * 16);
  const durHours = 2 + Math.floor(Math.random() * 12);
  const arrHour = (depHour + durHours) % 24;
  return {
    airline,
    flightNumber: `${airline.slice(0, 2).toUpperCase()}${100 + Math.floor(Math.random() * 900)}`,
    departure: `${date}T${String(depHour).padStart(2, '0')}:${['00', '15', '30', '45'][Math.floor(Math.random() * 4)]}`,
    arrival: `${date}T${String(arrHour).padStart(2, '0')}:${['00', '15', '30', '45'][Math.floor(Math.random() * 4)]}`,
    duration: `${durHours}h ${Math.floor(Math.random() * 4) * 15}m`,
    price: Math.round(200 + Math.random() * 1300),
    currency: 'USD',
  };
}

const searchFlights = defineCapability({
  id: 'search-flights',
  name: 'Flight Search',
  description: 'Search for flights between two cities',
  tags: ['travel', 'flights', 'booking'],
  input: z.object({
    origin: z.string().min(3).max(3).describe('Origin IATA code'),
    destination: z.string().min(3).max(3).describe('Destination IATA code'),
    date: z.string().describe('Travel date (YYYY-MM-DD)'),
    passengers: z.number().int().min(1).default(1),
  }),
  output: z.object({
    flights: z.array(z.object({
      airline: z.string(), flightNumber: z.string(), departure: z.string(),
      arrival: z.string(), duration: z.string(), price: z.number(), currency: z.string(),
    })),
  }),
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(20, `Searching flights ${input.origin} → ${input.destination}...`);
    await new Promise((r) => setTimeout(r, 250));
    ctx.progress(60, 'Comparing airlines...');
    const count = 3 + Math.floor(Math.random() * 3);
    const flights = Array.from({ length: count }, () => randomFlight(input.origin, input.destination, input.date));
    flights.sort((a, b) => a.price - b.price);
    if (input.passengers > 1) flights.forEach((f) => (f.price *= input.passengers));
    ctx.progress(90, `Found ${flights.length} flights`);
    return { flights };
  },
});

const port = Number(process.env['PORT'] ?? 4213);
const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';

const agent = new Agent({ name: 'FlightFinder', description: 'Finds the best flight deals', capabilities: [searchFlights], registry: registryUrl, port });
agent.on('started', ({ id }) => { console.log(`✈️  FlightFinder online\n   ID: ${id}\n   Port: ${port}`); });
agent.on('task:start', ({ taskId, capabilityId }) => { console.log(`   📋 Task ${taskId.slice(0, 8)}... → ${capabilityId}`); });
agent.on('task:complete', ({ taskId, durationMs }) => { console.log(`   ✅ Task ${taskId.slice(0, 8)}... done in ${durationMs}ms`); });
agent.on('error', (err) => { console.error(`   ❌ Error:`, err.message); });
agent.start().catch(console.error);
process.on('SIGINT', async () => { await agent.stop(); process.exit(0); });
