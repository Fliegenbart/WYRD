import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

// Simple XML parser for RSS (no dependencies)
function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate: string; source: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; source: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = extractTag(item, 'title');
    const link = extractTag(item, 'link');
    const pubDate = extractTag(item, 'pubDate');
    const dashIdx = title.lastIndexOf(' - ');
    const source = dashIdx > 0 ? title.slice(dashIdx + 3) : 'Unknown';
    const cleanTitle = dashIdx > 0 ? title.slice(0, dashIdx) : title;

    items.push({ title: cleanTitle, link, pubDate, source });
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's');
  const match = regex.exec(xml);
  return match ? match[1].trim() : '';
}

function guessSentiment(title: string): 'positive' | 'neutral' | 'negative' {
  const lower = title.toLowerCase();
  const positive = ['breakthrough', 'success', 'growth', 'surpass', 'record', 'boost', 'advance', 'improve', 'win', 'launch', 'innovation'];
  const negative = ['crisis', 'crash', 'fail', 'risk', 'threat', 'ban', 'decline', 'drop', 'warn', 'concern', 'attack', 'layoff', 'cut'];
  if (positive.some((w) => lower.includes(w))) return 'positive';
  if (negative.some((w) => lower.includes(w))) return 'negative';
  return 'neutral';
}

const summarizeNews = defineCapability({
  id: 'summarize-news',
  name: 'News Summarizer',
  description: 'Fetch and summarize real news on any topic (powered by Google News RSS)',
  tags: ['news', 'summary', 'media', 'current-events', 'real-time'],
  input: z.object({
    topic: z.string().describe('Topic to search for'),
    count: z.number().int().min(1).max(10).default(5),
  }),
  output: z.object({
    articles: z.array(z.object({
      title: z.string(),
      source: z.string(),
      publishedAt: z.string(),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      url: z.string(),
    })),
    overallSentiment: z.string(),
    dataSource: z.string(),
  }),
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(20, `Searching news for "${input.topic}"...`);

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(input.topic)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(rssUrl);
    if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);

    const xml = await res.text();
    ctx.progress(60, 'Parsing articles...');

    const allItems = parseRssItems(xml);
    const articles = allItems.slice(0, input.count).map((item) => ({
      title: item.title,
      source: item.source,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      sentiment: guessSentiment(item.title),
      url: item.link,
    }));

    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    articles.forEach((a) => sentimentCounts[a.sentiment]++);
    const overallSentiment = (Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0])[0];

    ctx.progress(90, `Found ${articles.length} articles`);

    return { articles, overallSentiment, dataSource: 'Google News RSS (news.google.com)' };
  },
});

const registryUrl = process.env['WYRD_REGISTRY_URL'] ?? 'http://localhost:4200';
const port = Number(process.env['PORT'] ?? 4217);

const agent = new Agent({
  name: 'NewsSummarizer',
  description: 'Real-time news from Google News RSS with sentiment analysis',
  capabilities: [summarizeNews],
  registry: registryUrl,
  port,
});

agent.on('started', ({ id }) => {
  console.log(`📰 NewsSummarizer online (real API)`);
  console.log(`   ID: ${id}`);
  console.log(`   Port: ${port}`);
  console.log(`   Data: Google News RSS`);
});

agent.on('task:start', ({ taskId }) => { console.log(`   📋 Task ${taskId.slice(0, 8)}... → summarize-news`); });
agent.on('task:complete', ({ taskId, durationMs }) => { console.log(`   ✅ Task ${taskId.slice(0, 8)}... done in ${durationMs}ms`); });
agent.on('error', (err) => { console.error(`   ❌ Error:`, err.message); });
agent.start().catch(console.error);
process.on('SIGINT', async () => { await agent.stop(); process.exit(0); });
