import { Agent, defineCapability } from '@agentnet/sdk';
import { z } from 'zod';

const STORES = ['Amazon', 'Best Buy', 'Walmart', 'eBay', 'Target', 'Newegg', 'B&H Photo'];

function generateResults(product: string, currency: string) {
  const basePrice = product.length * 15 + 50; // deterministic-ish base
  const count = 3 + Math.floor(Math.random() * 4);
  return Array.from({ length: count }, (_, i) => {
    const store = STORES[i % STORES.length];
    const variation = 0.8 + Math.random() * 0.4;
    const price = Math.round(basePrice * variation * 100) / 100;
    return {
      store,
      price,
      currency,
      url: `https://${store.toLowerCase().replace(/[^a-z]/g, '')}.com/product/${encodeURIComponent(product.toLowerCase().replace(/\s+/g, '-'))}`,
      inStock: Math.random() > 0.15,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
    };
  }).sort((a, b) => a.price - b.price);
}

const trackPrice = defineCapability({
  id: 'track-price',
  name: 'Price Tracker',
  description: 'Compare prices across major retailers',
  tags: ['shopping', 'price', 'deals', 'comparison'],
  input: z.object({
    product: z.string(),
    maxPrice: z.number().optional(),
    currency: z.string().default('USD'),
  }),
  output: z.object({
    product: z.string(),
    results: z.array(z.object({
      store: z.string(), price: z.number(), currency: z.string(),
      url: z.string(), inStock: z.boolean(), rating: z.number().optional(),
    })),
    lowestPrice: z.number(),
    averagePrice: z.number(),
  }),
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(20, `Searching for "${input.product}"...`);
    await new Promise((r) => setTimeout(r, 200));
    ctx.progress(60, 'Comparing prices across stores...');
    let results = generateResults(input.product, input.currency);
    if (input.maxPrice) results = results.filter((r) => r.price <= input.maxPrice!);
    const prices = results.map((r) => r.price);
    ctx.progress(90, `Found ${results.length} results`);
    return {
      product: input.product,
      results,
      lowestPrice: Math.min(...prices),
      averagePrice: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
    };
  },
});

const port = Number(process.env['PORT'] ?? 4216);
const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';
const agent = new Agent({ name: 'PriceTracker', description: 'Compares prices across major retailers', capabilities: [trackPrice], registry: registryUrl, port });
agent.on('started', ({ id }) => { console.log(`💰 PriceTracker online\n   ID: ${id}\n   Port: ${port}`); });
agent.on('task:start', ({ taskId }) => { console.log(`   📋 Task ${taskId.slice(0, 8)}... → track-price`); });
agent.on('task:complete', ({ taskId, durationMs }) => { console.log(`   ✅ Task ${taskId.slice(0, 8)}... done in ${durationMs}ms`); });
agent.on('error', (err) => { console.error(`   ❌ Error:`, err.message); });
agent.start().catch(console.error);
process.on('SIGINT', async () => { await agent.stop(); process.exit(0); });
