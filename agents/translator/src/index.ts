import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

const LANGUAGES: Record<string, string> = {
  en: 'English', ja: 'Japanese', de: 'German', es: 'Spanish', fr: 'French',
  ko: 'Korean', zh: 'Chinese', pt: 'Portuguese', it: 'Italian', nl: 'Dutch',
  ru: 'Russian', ar: 'Arabic', hi: 'Hindi', sv: 'Swedish', pl: 'Polish',
  tr: 'Turkish', da: 'Danish', fi: 'Finnish', no: 'Norwegian', cs: 'Czech',
};

const translateText = defineCapability({
  id: 'translate-text',
  name: 'Text Translation',
  description: 'Translate text between 20+ languages (powered by MyMemory API)',
  tags: ['translation', 'language', 'text', 'i18n'],
  input: z.object({
    text: z.string().describe('Text to translate'),
    from: z.string().min(2).max(2).describe('Source language code (e.g., "en")'),
    to: z.string().min(2).max(2).describe('Target language code (e.g., "ja")'),
  }),
  output: z.object({
    original: z.string(),
    translated: z.string(),
    from: z.string(),
    to: z.string(),
    fromLanguage: z.string(),
    toLanguage: z.string(),
    confidence: z.number(),
    source: z.string(),
  }),
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    const fromLang = LANGUAGES[input.from] ?? input.from;
    const toLang = LANGUAGES[input.to] ?? input.to;
    ctx.progress(20, `Translating from ${fromLang} to ${toLang}...`);

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(input.text)}&langpair=${input.from}|${input.to}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Translation API error: ${res.status}`);

    const data = await res.json() as any;
    ctx.progress(80, 'Processing response...');

    if (data.responseStatus !== 200) {
      throw new Error(`Translation failed: ${data.responseDetails || 'Unknown error'}`);
    }

    // Get the best match
    const translated = data.responseData.translatedText;
    const match = data.responseData.match ?? 0;

    return {
      original: input.text,
      translated,
      from: input.from,
      to: input.to,
      fromLanguage: fromLang,
      toLanguage: toLang,
      confidence: Math.min(match, 1),
      source: 'MyMemory (mymemory.translated.net)',
    };
  },
});

const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';
const port = Number(process.env['PORT'] ?? 4212);

const agent = new Agent({
  name: 'TranslatorBot',
  description: 'Real-time translation across 20+ languages powered by MyMemory',
  capabilities: [translateText],
  registry: registryUrl,
  port,
});

agent.on('started', ({ id }) => {
  console.log(`🌐 TranslatorBot online (real API)`);
  console.log(`   ID: ${id}`);
  console.log(`   Port: ${port}`);
  console.log(`   Data: MyMemory (mymemory.translated.net)`);
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
