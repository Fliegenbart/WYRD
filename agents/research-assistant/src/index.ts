import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

const TOPICS: Record<string, { summary: string; findings: string[]; sources: { title: string; relevance: number }[] }> = {
  ai: {
    summary: 'Artificial intelligence has seen rapid advancement in transformer architectures, multimodal models, and agent-based systems. Large language models now demonstrate emergent reasoning capabilities.',
    findings: [
      'Transformer architectures remain dominant across NLP, vision, and multimodal tasks',
      'Agent-based AI systems are emerging as a new paradigm for autonomous task completion',
      'Scaling laws continue to hold but efficiency improvements are narrowing the gap',
      'Safety and alignment research is becoming a critical focus area',
    ],
    sources: [
      { title: 'Attention Is All You Need - Vaswani et al.', relevance: 0.95 },
      { title: 'Language Models are Few-Shot Learners', relevance: 0.92 },
      { title: 'Constitutional AI - Anthropic', relevance: 0.88 },
    ],
  },
  climate: {
    summary: 'Climate science indicates accelerating warming trends with significant impacts on ecosystems, weather patterns, and sea levels. Renewable energy adoption is increasing but may not meet Paris Agreement targets.',
    findings: [
      'Global temperatures have risen 1.2°C above pre-industrial levels',
      'Arctic sea ice extent continues to decline at approximately 13% per decade',
      'Renewable energy capacity grew 50% in 2023, led by solar',
      'Carbon capture technologies are advancing but remain limited in scale',
    ],
    sources: [
      { title: 'IPCC Sixth Assessment Report', relevance: 0.97 },
      { title: 'Global Carbon Budget 2024', relevance: 0.91 },
      { title: 'Nature Climate Change - Recent Trends', relevance: 0.85 },
    ],
  },
  quantum: {
    summary: 'Quantum computing is progressing toward practical quantum advantage. Error correction breakthroughs and new qubit architectures are pushing the field forward.',
    findings: [
      'Logical qubit error rates have been reduced below physical qubit rates',
      'Quantum advantage demonstrated for specific optimization problems',
      'Hybrid quantum-classical algorithms show promise for drug discovery',
      'Topological qubits remain a long-term goal but are showing progress',
    ],
    sources: [
      { title: 'Google Quantum AI - Willow Processor', relevance: 0.94 },
      { title: 'IBM Quantum Roadmap', relevance: 0.89 },
      { title: 'Nature - Advances in Quantum Error Correction', relevance: 0.86 },
    ],
  },
};

const researchTopic = defineCapability({
  id: 'research-topic',
  name: 'Research Assistant',
  description: 'Deep research on any topic with findings and sources',
  tags: ['research', 'analysis', 'knowledge'],
  input: z.object({
    topic: z.string(),
    depth: z.enum(['brief', 'detailed']).default('brief'),
    maxSources: z.number().int().min(1).default(5),
  }),
  output: z.object({
    summary: z.string(),
    keyFindings: z.array(z.string()),
    sources: z.array(z.object({ title: z.string(), relevance: z.number() })),
    confidence: z.number(),
  }),
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(15, `Researching "${input.topic}"...`);
    await new Promise((r) => setTimeout(r, 300));
    ctx.progress(50, 'Analyzing sources...');

    const key = Object.keys(TOPICS).find((k) => input.topic.toLowerCase().includes(k));
    const data = key ? TOPICS[key] : null;

    ctx.progress(80, 'Compiling findings...');
    if (data) {
      return {
        summary: data.summary,
        keyFindings: input.depth === 'brief' ? data.findings.slice(0, 2) : data.findings,
        sources: data.sources.slice(0, input.maxSources),
        confidence: 0.85,
      };
    }

    return {
      summary: `Research on "${input.topic}" indicates an active and evolving field with ongoing developments. Further specialized investigation recommended.`,
      keyFindings: [
        `"${input.topic}" is an area of active research and development`,
        'Multiple peer-reviewed sources discuss recent breakthroughs',
        'Cross-disciplinary applications are emerging',
      ],
      sources: [
        { title: `Survey of ${input.topic} — Annual Review`, relevance: 0.7 },
        { title: `${input.topic}: State of the Art — IEEE`, relevance: 0.65 },
      ],
      confidence: 0.45,
    };
  },
});

const port = Number(process.env['PORT'] ?? 4215);
const registryUrl = process.env['WYRD_REGISTRY_URL'] ?? 'http://localhost:4200';
const agent = new Agent({ name: 'ResearchAssistant', description: 'Deep research on any topic', capabilities: [researchTopic], registry: registryUrl, port });
agent.on('started', ({ id }) => { console.log(`🔬 ResearchAssistant online\n   ID: ${id}\n   Port: ${port}`); });
agent.on('task:start', ({ taskId }) => { console.log(`   📋 Task ${taskId.slice(0, 8)}... → research-topic`); });
agent.on('task:complete', ({ taskId, durationMs }) => { console.log(`   ✅ Task ${taskId.slice(0, 8)}... done in ${durationMs}ms`); });
agent.on('error', (err) => { console.error(`   ❌ Error:`, err.message); });
agent.start().catch(console.error);
process.on('SIGINT', async () => { await agent.stop(); process.exit(0); });
