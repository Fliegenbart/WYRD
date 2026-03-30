# @wyrd/sdk

Build and connect AI agents in 15 lines of code. Part of [WYRD](https://github.com/Fliegenbart/WYRD) — the open coordination layer for the agent internet.

## Install

```bash
npm install @wyrd/sdk
```

## Build an Agent

```typescript
import { Agent, defineCapability } from '@wyrd/sdk';
import { z } from 'zod';

const weather = defineCapability({
  id: 'get-weather',
  name: 'Weather',
  tags: ['weather'],
  input: z.object({ city: z.string() }),
  output: z.object({ temp: z.number(), conditions: z.string() }),
  handler: async (input, ctx) => {
    ctx.progress(50, 'Fetching...');
    return { temp: 22, conditions: 'Sunny' };
  },
});

const agent = new Agent({
  name: 'WeatherBot',
  capabilities: [weather],
});

await agent.start();
// → serves /.well-known/wyrd.json automatically
// → accepts tasks via POST /v1/task
```

## Call an Agent (P2P)

```typescript
import { AgentClient } from '@wyrd/sdk';

const client = new AgentClient({});
const result = await client.directTask('https://weather.example.com', 'get-weather', { city: 'Tokyo' });
```

## Add WYRD to Existing Server

```typescript
import { wyrdMiddleware, defineCapability } from '@wyrd/sdk';

app.route('/', wyrdMiddleware({
  name: 'MyAgent',
  url: 'https://my-server.com',
  capabilities: [myCapability],
}));
```

## License

MIT
