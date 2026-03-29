import { Agent, AgentClient, defineCapability } from '@agentnet/sdk';
import { z } from 'zod';

const registryUrl = process.env['AGENTNET_REGISTRY_URL'] ?? 'http://localhost:4200';
const port = Number(process.env['PORT'] ?? 4210);

// The orchestrator client — discovers and delegates to other agents
const client = new AgentClient({ registry: registryUrl });

const planTrip = defineCapability({
  id: 'plan-trip',
  name: 'Trip Planner',
  description: 'Plans a trip by coordinating weather, translation, and other agents',
  tags: ['orchestration', 'travel', 'planning'],
  input: z.object({
    destination: z.string().describe('Destination city'),
    interests: z.array(z.string()).default([]).describe('Travel interests'),
    language: z.string().default('en').describe('Preferred language code'),
  }),
  output: z.object({
    destination: z.string(),
    weather: z.any().optional(),
    translations: z.array(z.any()).optional(),
    plan: z.string(),
    agentsUsed: z.array(z.string()),
    totalDurationMs: z.number(),
  }),
  handler: async (input, ctx) => {
    const startTime = Date.now();
    const agentsUsed: string[] = [];
    const results: Record<string, any> = {};

    ctx.progress(10, `Planning trip to ${input.destination}...`);

    // Step 1: Find weather agent and get forecast
    ctx.progress(20, 'Looking for weather agents...');
    try {
      const weatherAgents = await client.discover({ tags: ['weather'], limit: 1 });
      if (weatherAgents.length > 0) {
        ctx.progress(30, `Found weather agent: ${weatherAgents[0].name ?? weatherAgents[0].agentId.slice(0, 8)}...`);
        const weatherResult = await client.task(weatherAgents[0].agentId, 'get-weather', {
          city: input.destination,
          units: 'celsius',
        });
        results.weather = weatherResult.output;
        agentsUsed.push(`WeatherBot (${weatherAgents[0].agentId.slice(0, 8)}...)`);
        ctx.progress(50, `Got weather for ${input.destination}: ${(weatherResult.output as any)?.conditions}`);
      }
    } catch (err) {
      ctx.log.warn(`Weather lookup failed: ${err}`);
    }

    // Step 2: Find translator and get useful phrases
    ctx.progress(60, 'Looking for translation agents...');
    const translations: any[] = [];
    if (input.language !== 'en') {
      try {
        const translatorAgents = await client.discover({ tags: ['translation'], limit: 1 });
        if (translatorAgents.length > 0) {
          ctx.progress(70, `Found translator: ${translatorAgents[0].name ?? translatorAgents[0].agentId.slice(0, 8)}...`);

          const phrases = ['hello', 'thank you', 'goodbye', 'please', 'how are you'];
          for (const phrase of phrases) {
            try {
              const result = await client.task(translatorAgents[0].agentId, 'translate-text', {
                text: phrase,
                from: 'en',
                to: input.language,
              });
              translations.push(result.output);
            } catch {
              // Skip failed translations
            }
          }
          agentsUsed.push(`TranslatorBot (${translatorAgents[0].agentId.slice(0, 8)}...)`);
        }
      } catch (err) {
        ctx.log.warn(`Translation failed: ${err}`);
      }
    }

    ctx.progress(90, 'Compiling trip plan...');

    // Build the trip plan summary
    const weatherSummary = results.weather
      ? `Weather: ${results.weather.temperature}°C, ${results.weather.conditions}`
      : 'Weather: unavailable';

    const translationSummary = translations.length > 0
      ? `\nUseful phrases:\n${translations.map((t: any) => `  "${t.original}" → "${t.translated}"`).join('\n')}`
      : '';

    const interestSummary = input.interests.length > 0
      ? `\nRecommended activities based on interests (${input.interests.join(', ')}): explore local culture, visit popular spots, try local cuisine.`
      : '';

    const plan = [
      `Trip Plan: ${input.destination}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      weatherSummary,
      interestSummary,
      translationSummary,
      `\n${agentsUsed.length} agents collaborated to create this plan.`,
    ].join('\n');

    const totalDurationMs = Date.now() - startTime;

    return {
      destination: input.destination,
      weather: results.weather,
      translations: translations.length > 0 ? translations : undefined,
      plan,
      agentsUsed,
      totalDurationMs,
    };
  },
});

const multiTask = defineCapability({
  id: 'multi-task',
  name: 'Multi-Task Orchestrator',
  description: 'Decomposes complex requests and delegates to specialized agents',
  tags: ['orchestration', 'workflow', 'multi-agent'],
  input: z.object({
    task: z.string().describe('High-level task description'),
    subtasks: z.array(z.object({
      capabilityId: z.string(),
      input: z.any(),
      tags: z.array(z.string()).optional(),
    })).describe('List of sub-tasks to delegate'),
  }),
  output: z.object({
    results: z.array(z.object({
      capabilityId: z.string(),
      agentId: z.string(),
      output: z.any(),
      durationMs: z.number(),
      status: z.enum(['success', 'error']),
      error: z.string().optional(),
    })),
    totalDurationMs: z.number(),
    successCount: z.number(),
    errorCount: z.number(),
  }),
  handler: async (input, ctx) => {
    const startTime = Date.now();
    const results: any[] = [];

    ctx.progress(5, `Orchestrating ${input.subtasks.length} sub-tasks...`);

    for (let i = 0; i < input.subtasks.length; i++) {
      const subtask = input.subtasks[i];
      const progress = 5 + Math.round((i / input.subtasks.length) * 85);
      ctx.progress(progress, `Running sub-task ${i + 1}/${input.subtasks.length}: ${subtask.capabilityId}`);

      try {
        // Discover an agent for this capability
        const agents = await client.discover({
          capabilityId: subtask.capabilityId,
          tags: subtask.tags,
          limit: 1,
        });

        if (agents.length === 0) {
          results.push({
            capabilityId: subtask.capabilityId,
            agentId: 'none',
            output: null,
            durationMs: 0,
            status: 'error',
            error: 'No agent found for this capability',
          });
          continue;
        }

        const taskStart = Date.now();
        const result = await client.task(agents[0].agentId, subtask.capabilityId, subtask.input);

        results.push({
          capabilityId: subtask.capabilityId,
          agentId: agents[0].agentId,
          output: result.output,
          durationMs: Date.now() - taskStart,
          status: 'success',
        });
      } catch (err) {
        results.push({
          capabilityId: subtask.capabilityId,
          agentId: 'unknown',
          output: null,
          durationMs: 0,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      results,
      totalDurationMs: Date.now() - startTime,
      successCount: results.filter((r) => r.status === 'success').length,
      errorCount: results.filter((r) => r.status === 'error').length,
    };
  },
});

const agent = new Agent({
  name: 'Orchestrator',
  description: 'Meta-agent that decomposes complex tasks and delegates to specialized agents',
  capabilities: [planTrip, multiTask],
  registry: registryUrl,
  port,
});

agent.on('started', ({ id }) => {
  console.log(`🎯 Orchestrator online`);
  console.log(`   ID: ${id}`);
  console.log(`   Port: ${port}`);
  console.log(`   Registry: ${registryUrl}`);
  console.log(`   Capabilities: plan-trip, multi-task`);
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
  console.log('\n   Shutting down Orchestrator...');
  await client.close();
  await agent.stop();
  process.exit(0);
});
