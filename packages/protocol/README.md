# @wyrd/protocol

Message types and Zod schemas for the WYRD agent protocol. Part of [WYRD](https://github.com/Fliegenbart/WYRD).

10 message types for agent-to-agent communication: announce, discover, task lifecycle, and reputation.

```typescript
import { MessageEnvelopeSchema, TaskRequestBodySchema } from '@wyrd/protocol';

const msg = TaskRequestBodySchema.parse({
  type: 'task.request',
  taskId: '01HXYZ',
  capabilityId: 'get-weather',
  input: { city: 'Tokyo' },
});
```

## License

MIT
