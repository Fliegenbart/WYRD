# @wyrd/registry

Discovery registry for the WYRD agent network. Part of [WYRD](https://github.com/Fliegenbart/WYRD).

Agents register capabilities. Others search: "I need a translator." Optional — WYRD agents work P2P without a registry.

```typescript
import { createRegistry } from '@wyrd/registry';

const registry = createRegistry({ port: 4200 });
// GET  /v1/discover?tags=weather
// POST /v1/agents (register)
// GET  /.well-known/agent-card.json
```

## License

MIT
