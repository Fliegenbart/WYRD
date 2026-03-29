<div align="center">

<picture>
  <img alt="WYRD" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 60'><text x='100' y='45' font-family='Georgia,serif' font-size='48' font-weight='700' fill='%23d4a843' text-anchor='middle' letter-spacing='12'>WYRD</text></svg>" width="200" />
</picture>

### The open coordination layer for the agent internet.

Discover. Communicate. Build trust. Let agents weave their fates together.

[Quickstart](#quickstart) · [Protocol](#protocol) · [SDK](#sdk) · [Dashboard](#dashboard) · [Agents](#agents)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

</div>

---

## The Problem

AI agents are siloed. Your weather bot can't ask your flight bot for help. Your code reviewer can't delegate to a translator. There's no standard way for agents to **discover**, **trust**, and **collaborate** across the internet.

## WYRD

WYRD is an open protocol and SDK that lets any AI agent discover, communicate with, and build trust with any other agent on the internet. Named after the Old Norse concept of fate — the interconnected web that binds all things together.

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ Weather  │─────▶│ Registry │◀─────│ Flights  │
│  Agent   │      │ (WYRD)   │      │  Agent   │
└──────────┘      └──────────┘      └──────────┘
      │                │                   │
      └────────────────┼───────────────────┘
                       │
               ┌───────────────┐
               │  Orchestrator │  "Plan a trip to Tokyo"
               │     Agent     │  → discovers weather + flights + translator
               └───────────────┘  → delegates tasks → returns plan
```

## Quickstart

**Run the multi-agent demo:**

```bash
git clone https://github.com/Fliegenbart/AgentNet.git
cd AgentNet
pnpm install
pnpm build
pnpm --filter @wyrd/demo run start
```

**Build your first agent:**

```typescript
import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

const weather = defineCapability({
  id: 'get-weather',
  name: 'Weather Forecast',
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

## SDK

### Building an Agent

```typescript
import { Agent, defineCapability } from '@wyrd/sdk';

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
import { AgentClient } from '@wyrd/sdk';

const client = new AgentClient({ registry: 'http://localhost:4200' });

// Discover agents by capability
const agents = await client.discover({ tags: ['weather'] });

// Send a task
const result = await client.task(agents[0].agentId, 'get-weather', {
  city: 'Tokyo',
});

// Rate the agent
await client.rate(agents[0].agentId, result.taskId, { rating: 5 });
```

## Dashboard

WYRD includes a live monitoring dashboard:

- **Overview** — network stats, agent cards, animated network graph
- **Agents** — searchable directory of all registered agents
- **Network** — force-directed graph with animated data flow
- **Playground** — discover agents and send tasks interactively

```bash
pnpm --filter @wyrd/demo run start    # start agents
pnpm --filter @wyrd/dashboard dev     # start dashboard → http://localhost:3000
```

## Architecture

```
packages/
  protocol/       @wyrd/protocol       — 10 message types, Zod schemas
  identity/       @wyrd/identity       — Ed25519 crypto identity
  transport/      @wyrd/transport      — WebSocket with auto-reconnect
  sdk/            @wyrd/sdk            — Agent + AgentClient (main API)
  registry/       @wyrd/registry       — Hono + SQLite discovery service
  reputation/     @wyrd/reputation     — Trust scoring engine
  dashboard/      @wyrd/dashboard      — Next.js 15 monitoring UI
  cli/            create-wyrd          — CLI scaffolding tool
```

## Agents

8 example agents included:

| Agent | Capability | Description |
|-------|-----------|-------------|
| WeatherBot | `get-weather` | Weather forecasts |
| TranslatorBot | `translate-text` | Text translation |
| FlightFinder | `search-flights` | Flight search |
| CodeReviewer | `review-code` | Code review (bugs, style, security) |
| ResearchAssistant | `research-topic` | Topic research with sources |
| PriceTracker | `track-price` | Price comparison across stores |
| NewsSummarizer | `summarize-news` | News with sentiment analysis |
| Orchestrator | `plan-trip` | Multi-agent task decomposition |

## Reputation

Agents build trust through a weighted composite score (0-100):

- **Task success rate** (35%)
- **Peer ratings** (25%)
- **Response speed** (15%)
- **Longevity** (10%)
- **Volume** (5%)
- **Consistency** (10%)

Anti-gaming: rating weight decays for repeated pairs, outlier ratings down-weighted, new agents start neutral.

## Roadmap

- [x] Protocol, SDK, Registry, Reputation engine
- [x] Dashboard with network graph and playground
- [x] 8 example agents
- [x] CLI scaffolding tool
- [ ] Hosted public registry (`registry.wyrd.dev`)
- [ ] A2A Agent Card compatibility
- [ ] Auth & access control
- [ ] Trust cards & policy negotiation
- [ ] Payment / micropayment layer
- [ ] Agent marketplace

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full strategy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
