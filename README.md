<div align="center">

<picture>
  <img alt="WYRD" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 60'><text x='100' y='45' font-family='Georgia,serif' font-size='48' font-weight='700' fill='%23d4a843' text-anchor='middle' letter-spacing='12'>WYRD</text></svg>" width="200" />
</picture>

### The open coordination layer for the agent internet.

Every agent hosts `/.well-known/wyrd.json`. Any WYRD agent can discover, handshake, and collaborate with it directly — no central server required.

[Live Demo](https://dashboard-wine-zeta-35.vercel.app) · [Quickstart](#quickstart) · [P2P Protocol](#peer-to-peer) · [SDK](#sdk) · [Agents](#agents)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

</div>

---

## The Vision

A decentralized agent internet where every AI agent can find and collaborate with any other agent — like websites can link to each other without Google.

```
Agent A (any server)              Agent B (any server)
├── /.well-known/wyrd.json        ├── /.well-known/wyrd.json
├── POST /v1/task                 ├── POST /v1/task
├── Ed25519 identity              ├── Ed25519 identity
└── speaks WYRD protocol          └── speaks WYRD protocol
              ↕ direct P2P ↕
         No central registry needed.
```

Named after the Old Norse concept of **wyrd** — the interconnected web of fate that binds all things together.

## Quickstart

**Run the full demo (8 agents with real APIs):**

```bash
git clone https://github.com/Fliegenbart/wyrd.git
cd wyrd
pnpm install
pnpm build
pnpm --filter @wyrd/demo run start
```

You'll see agents discover each other, exchange tasks, and collaborate — with **real weather data** (Open-Meteo), **real translations** (MyMemory), and **real news** (Google News RSS).

## Peer-to-Peer

Every WYRD agent is a self-contained HTTP + WebSocket server. No registry needed.

**Connect directly by URL:**

```typescript
import { AgentClient } from '@wyrd/sdk';

const client = new AgentClient({}); // no registry!

// Read any agent's identity card
const card = await client.fetchWyrdCard('https://weather.example.com');
// → { name: 'WeatherBot', capabilities: [...], publicKey: '...' }

// Send a task directly — P2P, no middleman
const result = await client.directTask(
  'https://weather.example.com',
  'get-weather',
  { city: 'Tokyo' },
);
// → { output: { temperature: 10.5, conditions: 'Clear sky', source: 'Open-Meteo' } }
```

**The `/.well-known/wyrd.json` standard:**

Every WYRD agent automatically serves its identity card:

```json
{
  "wyrd": "1.0",
  "id": "7Xk9mP2...",
  "name": "WeatherBot",
  "capabilities": [{ "id": "get-weather", "tags": ["weather"] }],
  "publicKey": "7Xk9mP2...",
  "transport": {
    "http": "https://weather.example.com/v1/task",
    "websocket": "wss://weather.example.com/ws"
  }
}
```

The registry is **optional** — a search engine for agents, not a gatekeeper.

## Build Your First Agent

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
});

await agent.start();
// → HTTP server on auto-assigned port
// → /.well-known/wyrd.json served automatically
// → POST /v1/task ready for incoming tasks
// → WebSocket listening for real-time connections
```

Your agent is now a P2P node on the agent internet.

## Protocol

10 message types. Simple enough for any language. Powerful enough for multi-agent workflows.

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

Every message is signed with Ed25519. Discovery via registry (HTTP) or direct via `/.well-known/wyrd.json`. Task messages go peer-to-peer.

## SDK

### AgentClient — Two Ways to Connect

```typescript
import { AgentClient } from '@wyrd/sdk';

// ── P2P Mode (no registry) ──────────────────────────
const p2p = new AgentClient({});

// Direct task by URL
const result = await p2p.directTask('https://weather.example.com', 'get-weather', { city: 'Tokyo' });

// Read agent's WYRD card
const card = await p2p.fetchWyrdCard('https://weather.example.com');

// ── Registry Mode (discovery) ────────────────────────
const registry = new AgentClient({ registry: 'http://localhost:4200' });

// Discover agents by tag
const agents = await registry.discover({ tags: ['weather'] });

// Task by agent ID
const result2 = await registry.task(agents[0].agentId, 'get-weather', { city: 'Tokyo' });
```

## Agents

8 example agents — 3 with real APIs (no API keys required):

| Agent | Capability | Data Source |
|-------|-----------|-------------|
| WeatherBot | `get-weather` | **Open-Meteo API** (real) |
| TranslatorBot | `translate-text` | **MyMemory API** (real) |
| NewsSummarizer | `summarize-news` | **Google News RSS** (real) |
| FlightFinder | `search-flights` | Simulated |
| CodeReviewer | `review-code` | Simulated |
| ResearchAssistant | `research-topic` | Simulated |
| PriceTracker | `track-price` | Simulated |
| Orchestrator | `plan-trip` | Chains other agents |

The Orchestrator demo: "Plan a trip to Tokyo" → discovers WeatherBot + FlightFinder + TranslatorBot + NewsSummarizer → delegates tasks → returns a plan with real weather, translations, and news.

## A2A Compatibility

WYRD agents are compatible with the [A2A protocol](https://a2a-protocol.org):

- `GET /v1/agents/:id/agent-card` — A2A-format Agent Card
- `GET /.well-known/agent-card.json` — Registry's own Agent Card
- Capabilities mapped as A2A Skills with input/output schemas
- WYRD reputation score included as extension

## Dashboard

Live monitoring dashboard deployed at **[dashboard-wine-zeta-35.vercel.app](https://dashboard-wine-zeta-35.vercel.app)**:

- **Landing Page** — WYRD branding, animated network graph, protocol overview
- **Dashboard** — network stats, agent cards, live network visualization
- **Playground** — discover agents and send tasks interactively

```bash
pnpm --filter @wyrd/dashboard dev   # → http://localhost:3000
```

## Architecture

```
packages/
  protocol/       @wyrd/protocol     — 10 message types, Zod schemas
  identity/       @wyrd/identity     — Ed25519 crypto identity
  transport/      @wyrd/transport    — WebSocket with auto-reconnect
  sdk/            @wyrd/sdk          — Agent + AgentClient (P2P + registry)
  registry/       @wyrd/registry     — Hono + SQLite discovery service
  reputation/     @wyrd/reputation   — Trust scoring engine
  dashboard/      @wyrd/dashboard    — Next.js 15 monitoring UI + landing page
  cli/            create-wyrd        — CLI scaffolding tool

agents/           8 example agents (3 with real APIs)
```

## Roadmap

- [x] Protocol with 10 message types + Zod schemas
- [x] Ed25519 cryptographic identity + message signing
- [x] P2P agent communication (HTTP + WebSocket)
- [x] `/.well-known/wyrd.json` agent identity standard
- [x] Discovery registry with reputation scoring
- [x] SDK: `defineCapability()` + `Agent` + `AgentClient`
- [x] A2A Agent Card compatibility
- [x] Dashboard with network graph + playground
- [x] 8 example agents (3 with real APIs)
- [x] Vercel deployment
- [ ] Hosted public registry (`registry.wyrd.dev`)
- [ ] `npm publish` all packages
- [ ] Auth & access control
- [ ] Trust cards & policy negotiation
- [ ] Payment / micropayment layer
- [ ] Multi-registry federation
- [ ] Agent marketplace

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full strategy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
