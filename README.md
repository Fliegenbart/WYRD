<div align="center">

# AgentNet

**The open protocol for agent-to-agent communication on the internet.**

Deploy agents. Discover agents. Let them work together.

[Quickstart](#quickstart) &middot; [How It Works](#how-it-works) &middot; [Demo](#demo) &middot; [Protocol](#protocol) &middot; [SDK](#sdk-api) &middot; [Dashboard](#dashboard)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

</div>

---

## The Problem

AI agents are siloed. Your flight agent can't talk to your calendar agent. Your research bot can't ask a translation bot for help. There's no way for agents to **discover**, **trust**, and **collaborate** with each other across the internet.

## The Solution

AgentNet is an open protocol that lets any AI agent discover, communicate with, and build trust with any other agent on the internet. Think DNS + HTTP, but for agents.

```
┌─────────┐     ┌──────────┐     ┌─────────────┐
│ Weather  │────▶│ Registry │◀────│ Translator  │
│  Agent   │     │(Discovery)│     │   Agent     │
└─────────┘     └──────────┘     └─────────────┘
      │              │                   │
      └──────────────┼───────────────────┘
                     │
              ┌──────────────┐
              │ Orchestrator │  "Plan a trip to Tokyo"
              │    Agent     │  → discovers weather + translator
              └──────────────┘  → delegates tasks → returns result
```

## Quickstart

**Run the multi-agent demo in 30 seconds:**

```bash
git clone https://github.com/yourusername/agentnet.git
cd agentnet
pnpm install
pnpm build
pnpm --filter @agentnet/demo run start
```

You'll see agents discover each other, exchange tasks, and collaborate in real-time.

**Build your first agent in 15 lines:**

```typescript
import { Agent, defineCapability } from '@agentnet/sdk';
import { z } from 'zod';

const weather = defineCapability({
  id: 'get-weather',
  name: 'Weather',
  description: 'Get weather forecast for a city',
  tags: ['weather', 'forecast'],
  input: z.object({ city: z.string() }),
  output: z.object({ temp: z.number(), conditions: z.string() }),
  handler: async (input, ctx) => {
    ctx.progress(50, 'Fetching forecast...');
    return { temp: 22, conditions: 'Sunny' };
  },
});

const agent = new Agent({
  name: 'WeatherBot',
  capabilities: [weather],
  registry: 'http://localhost:4200',
});

await agent.start();
```

## How It Works

AgentNet has three layers:

### 1. Identity
Every agent gets a cryptographic identity (Ed25519 keypair). The agent ID is its public key, base58-encoded. All messages are signed — you always know who you're talking to.

### 2. Discovery
Agents announce their capabilities to a registry. Other agents search the registry to find collaborators: *"I need an agent that can translate text"* → registry returns matching agents with their capabilities and reputation scores.

### 3. Task Execution
Agents communicate directly via WebSocket. The protocol has exactly **10 message types** — simple enough to implement in any language, powerful enough for complex multi-agent workflows.

## Demo

The demo starts a registry + 2 agents, then shows them collaborating:

```
━━━ Demo: Agent Discovery & Collaboration ━━━

Discovering all agents on the network...
  Found 2 agents:
    WeatherBot (92PXhCpX...) — capabilities: get-weather
    TranslatorBot (8STNYbjp...) — capabilities: translate-text

━━━ Demo: Multi-Agent Collaboration ━━━

  Tokyo: 18°C, Partly Cloudy
  New York: 22°C, Sunny
  London: 14°C, Rainy

  Useful Japanese phrases:
    "hello" → "こんにちは" (confidence: 98%)
    "thank you" → "ありがとう" (confidence: 98%)
    "goodbye" → "さようなら" (confidence: 98%)

━━━ Network Stats ━━━
  Agents online: 2
  Total capabilities: 2
```

## Protocol

10 message types. That's it.

| # | Type | Direction | Purpose |
|---|------|-----------|---------|
| 1 | `announce` | Agent → Registry | Register capabilities |
| 2 | `discover` | Agent → Registry | Search for agents |
| 3 | `discover.result` | Registry → Agent | Matching agents |
| 4 | `task.request` | Agent → Agent | Request work |
| 5 | `task.accept` | Agent → Agent | Accept task |
| 6 | `task.reject` | Agent → Agent | Decline task |
| 7 | `task.progress` | Agent → Agent | Stream progress (0-100%) |
| 8 | `task.result` | Agent → Agent | Return result |
| 9 | `task.cancel` | Agent → Agent | Cancel task |
| 10 | `reputation.report` | Agent → Registry | Rate an agent |

Every message is signed with Ed25519. Discovery goes through the registry (HTTP). Task messages go peer-to-peer (WebSocket).

## SDK API

### Building an Agent

```typescript
import { Agent, defineCapability } from '@agentnet/sdk';

const cap = defineCapability({
  id: 'my-capability',
  name: 'My Capability',
  description: 'Does something useful',
  tags: ['example'],
  input: z.object({ query: z.string() }),
  output: z.object({ answer: z.string() }),
  handler: async (input, ctx) => {
    ctx.progress(50, 'Working...');
    return { answer: 'Done!' };
  },
});

const agent = new Agent({
  name: 'MyAgent',
  capabilities: [cap],
  registry: 'http://localhost:4200',
});

await agent.start();
```

### Calling Other Agents

```typescript
import { AgentClient } from '@agentnet/sdk';

const client = new AgentClient({
  registry: 'http://localhost:4200',
});

// Discover agents by capability
const agents = await client.discover({ tags: ['weather'] });

// Send a task
const result = await client.task(agents[0].agentId, 'get-weather', {
  city: 'Tokyo',
});
console.log(result.output); // { temp: 18, conditions: 'Partly Cloudy' }

// Rate the agent
await client.rate(agents[0].agentId, result.taskId, { rating: 5 });
```

## Architecture

```
packages/
  protocol/      @agentnet/protocol    — 10 message types, Zod schemas
  identity/      @agentnet/identity    — Ed25519 crypto identity
  transport/     @agentnet/transport   — WebSocket with auto-reconnect
  sdk/           @agentnet/sdk         — Agent + AgentClient (main API)
  registry/      @agentnet/registry    — Hono + SQLite discovery service
  reputation/    @agentnet/reputation  — Trust scoring engine

agents/
  weather/            WeatherBot         — Weather forecasts
  translator/         TranslatorBot      — Text translation
  flight-finder/      FlightFinder       — Flight search
  code-reviewer/      CodeReviewer       — Code review (bugs, style, security)
  research-assistant/ ResearchAssistant  — Topic research with sources
  price-tracker/      PriceTracker       — Price comparison across stores
  news-summarizer/    NewsSummarizer     — News with sentiment analysis
  orchestrator/       Orchestrator       — Multi-agent task decomposition
```

## Reputation System

Agents build trust through a weighted composite score (0-100):

- **Task success rate** (35%) — how often tasks complete successfully
- **Peer ratings** (25%) — 1-5 star ratings from other agents
- **Response speed** (15%) — performance vs SLA targets
- **Longevity** (10%) — how long the agent has been active
- **Task volume** (5%) — number of tasks completed
- **Consistency** (10%) — low variance in ratings

Anti-gaming measures: rating weight decays for repeated reporter-subject pairs, outlier ratings are down-weighted, new agents start at a neutral score with "low" confidence.

## Dashboard

AgentNet includes a live monitoring dashboard (Next.js + Tailwind):

- **Overview** — network stats, agent cards, animated network graph
- **Agents** — searchable directory of all registered agents
- **Network** — force-directed graph visualization with animated data packets
- **Playground** — discover agents and send tasks interactively

```bash
# Start agents first
pnpm --filter @agentnet/demo run start

# Then in another terminal
pnpm --filter @agentnet/dashboard dev
# → http://localhost:3000
```

## Roadmap

- [x] ~~Dashboard — live network visualization~~
- [x] ~~`npx create-agentnet` — CLI scaffolding tool~~
- [x] ~~8 example agents~~
- [ ] A2A protocol compatibility layer
- [ ] MCP tool exposure as capabilities
- [ ] Payment/micropayment layer
- [ ] Agent marketplace
- [ ] Multi-registry federation
- [ ] WASM sandboxed agent execution

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — build whatever you want with it.
