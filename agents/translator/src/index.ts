import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

// Simple translation dictionaries for demo
const TRANSLATIONS: Record<string, Record<string, Record<string, string>>> = {
  'en→ja': {
    'hello': 'こんにちは',
    'goodbye': 'さようなら',
    'thank you': 'ありがとうございます',
    'good morning': 'おはようございます',
    'how are you': 'お元気ですか',
    'please': 'お願いします',
    'yes': 'はい',
    'no': 'いいえ',
  },
  'en→de': {
    'hello': 'Hallo',
    'goodbye': 'Auf Wiedersehen',
    'thank you': 'Danke schön',
    'good morning': 'Guten Morgen',
    'how are you': 'Wie geht es Ihnen',
    'please': 'Bitte',
    'yes': 'Ja',
    'no': 'Nein',
  },
  'en→es': {
    'hello': 'Hola',
    'goodbye': 'Adiós',
    'thank you': 'Gracias',
    'good morning': 'Buenos días',
    'how are you': '¿Cómo estás?',
    'please': 'Por favor',
    'yes': 'Sí',
    'no': 'No',
  },
  'en→fr': {
    'hello': 'Bonjour',
    'goodbye': 'Au revoir',
    'thank you': 'Merci',
    'good morning': 'Bonjour',
    'how are you': 'Comment allez-vous',
    'please': "S'il vous plaît",
    'yes': 'Oui',
    'no': 'Non',
  },
};

const LANGUAGES: Record<string, string> = {
  en: 'English', ja: 'Japanese', de: 'German',
  es: 'Spanish', fr: 'French', ko: 'Korean',
  zh: 'Chinese', pt: 'Portuguese', it: 'Italian',
};

const translateText = defineCapability({
  id: 'translate-text',
  name: 'Text Translation',
  description: 'Translate text between languages',
  tags: ['translation', 'language', 'text', 'i18n'],
  input: z.object({
    text: z.string().describe('Text to translate'),
    from: z.string().length(2).describe('Source language code (e.g., "en")'),
    to: z.string().length(2).describe('Target language code (e.g., "ja")'),
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
  pricing: { model: 'free' },
  handler: async (input, ctx) => {
    ctx.progress(20, `Translating from ${LANGUAGES[input.from] ?? input.from} to ${LANGUAGES[input.to] ?? input.to}...`);

    await new Promise((r) => setTimeout(r, 150));

    const key = `${input.from}→${input.to}`;
    const dict = TRANSLATIONS[key];
    const lowerText = input.text.toLowerCase().trim();

    ctx.progress(70, 'Processing translation...');

    let translated: string;
    let confidence: number;

    if (dict && dict[lowerText]) {
      translated = dict[lowerText];
      confidence = 0.98;
    } else {
      // For demo: reverse the text + add language tag as "translation"
      translated = `[${input.to}] ${input.text.split('').reverse().join('')}`;
      confidence = 0.3;
    }

    return {
      original: input.text,
      translated,
      from: input.from,
      to: input.to,
      fromLanguage: LANGUAGES[input.from] ?? input.from,
      toLanguage: LANGUAGES[input.to] ?? input.to,
      confidence,
    };
  },
});

const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';
const port = Number(process.env['PORT'] ?? 4212);

const agent = new Agent({
  name: 'TranslatorBot',
  description: 'Translates text between multiple languages',
  capabilities: [translateText],
  registry: registryUrl,
  port,
});

agent.on('started', ({ id }) => {
  console.log(`🌐 TranslatorBot online`);
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
  console.log('\n   Shutting down TranslatorBot...');
  await agent.stop();
  process.exit(0);
});
