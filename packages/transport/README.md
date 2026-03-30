# @wyrd/transport

WebSocket transport layer with auto-reconnect for WYRD agents. Part of [WYRD](https://github.com/Fliegenbart/WYRD).

```typescript
import { WebSocketTransport } from '@wyrd/transport';

const transport = new WebSocketTransport();
await transport.listen(4201);
transport.onMessage((msg) => console.log(msg));
```

## License

MIT
