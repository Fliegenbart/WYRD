import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

const SOURCES = ['Reuters', 'AP News', 'BBC', 'The Guardian', 'Bloomberg', 'TechCrunch', 'Ars Technica', 'Wired'];
const SENTIMENTS: Array<'positive' | 'neutral' | 'negative'> = ['positive', 'neutral', 'negative'];

const TOPIC_ARTICLES: Record<string, Array<{ title: string; summary: string; sentiment: 'positive' | 'neutral' | 'negative' }>> = {
  ai: [
    { title: 'New AI Models Achieve Breakthrough in Scientific Reasoning', summary: 'Researchers demonstrate AI systems capable of novel hypothesis generation across multiple scientific domains.', sentiment: 'positive' },
    { title: 'Companies Race to Deploy AI Agents in Enterprise', summary: 'Major tech firms announce agent-based AI products designed for autonomous business workflow execution.', sentiment: 'neutral' },
    { title: 'Regulators Propose Framework for AI Agent Oversight', summary: 'EU and US regulators outline new guidelines specifically targeting autonomous AI systems operating on the internet.', sentiment: 'neutral' },
    { title: 'Open Source AI Models Close Gap with Proprietary Systems', summary: 'Community-developed models now match commercial offerings on key benchmarks, democratizing access.', sentiment: 'positive' },
  ],
  tech: [
    { title: 'Quantum Computing Reaches New Milestone', summary: 'A 1000-qubit processor demonstrates error correction below the fault-tolerance threshold.', sentiment: 'positive' },
    { title: 'Global Chip Shortage Eases as New Fabs Come Online', summary: 'Semiconductor capacity expansion in multiple regions begins to alleviate supply constraints.', sentiment: 'positive' },
    { title: 'Privacy Concerns Rise Over Smart Device Data Collection', summary: 'Consumer advocates call for stricter controls on data harvesting by IoT devices in homes.', sentiment: 'negative' },
  ],
  climate: [
    { title: 'Renewable Energy Surpasses Coal Globally for First Time', summary: 'Solar and wind capacity now generate more electricity than coal plants worldwide.', sentiment: 'positive' },
    { title: 'Arctic Ice Reaches Record Low for March', summary: 'Sea ice extent measurements confirm accelerating decline trend in polar regions.', sentiment: 'negative' },
    { title: 'Carbon Capture Plant Begins Operations in Iceland', summary: 'Largest direct air capture facility starts removing CO2 from the atmosphere at industrial scale.', sentiment: 'positive' },
  ],
};

const summarizeNews = defineCapability({
  id: 'summarize-news',
  name: 'News Summarizer',
  description: 'Summarize recent news on any topic',
  tags: ['news', 'summary', 'media', 'current-events'],
  input: z.object({
    topic: z.string(),
    count: z.number().int().min(1).max(10).default(3),
    language: z.string().default('en'),
  }),
  output: z.object({
    articles: z.array(z.object({
      title: z.string(), summary: z.string(), source: z.string(),
      publishedAt: z.string(), sentiment: z.enum(['positive', 'neutral', 'negative']),
    })),
    overallSentiment: z.string(),
  }),
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(20, `Scanning news for "${input.topic}"...`);
    await new Promise((r) => setTimeout(r, 200));
    ctx.progress(60, 'Summarizing articles...');

    const key = Object.keys(TOPIC_ARTICLES).find((k) => input.topic.toLowerCase().includes(k));
    const pool = key ? TOPIC_ARTICLES[key] : [
      { title: `Latest Developments in ${input.topic}`, summary: `New findings and updates emerge in the field of ${input.topic}, drawing attention from experts and industry leaders.`, sentiment: 'neutral' as const },
      { title: `${input.topic}: What Experts Are Saying`, summary: `Industry analysts weigh in on recent trends and future outlook for ${input.topic}.`, sentiment: 'neutral' as const },
    ];

    const articles = pool.slice(0, input.count).map((a, i) => ({
      ...a,
      source: SOURCES[i % SOURCES.length],
      publishedAt: new Date(Date.now() - i * 3600_000 * (1 + Math.random() * 12)).toISOString(),
    }));

    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    articles.forEach((a) => sentimentCounts[a.sentiment]++);
    const overallSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0][0];

    ctx.progress(90, `Found ${articles.length} articles`);
    return { articles, overallSentiment };
  },
});

const port = Number(process.env['PORT'] ?? 4217);
const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';
const agent = new Agent({ name: 'NewsSummarizer', description: 'Summarizes news on any topic', capabilities: [summarizeNews], registry: registryUrl, port });
agent.on('started', ({ id }) => { console.log(`📰 NewsSummarizer online\n   ID: ${id}\n   Port: ${port}`); });
agent.on('task:start', ({ taskId }) => { console.log(`   📋 Task ${taskId.slice(0, 8)}... → summarize-news`); });
agent.on('task:complete', ({ taskId, durationMs }) => { console.log(`   ✅ Task ${taskId.slice(0, 8)}... done in ${durationMs}ms`); });
agent.on('error', (err) => { console.error(`   ❌ Error:`, err.message); });
agent.start().catch(console.error);
process.on('SIGINT', async () => { await agent.stop(); process.exit(0); });
