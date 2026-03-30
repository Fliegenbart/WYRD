# @wyrd/identity

Ed25519 cryptographic identity for WYRD agents. Part of [WYRD](https://github.com/Fliegenbart/WYRD).

```typescript
import { generateIdentity, signMessage, verifyMessage } from '@wyrd/identity';

const identity = await generateIdentity();
console.log(identity.id); // base58-encoded public key

const signed = await signMessage(identity, message);
const valid = await verifyMessage(signed); // true
```

## License

MIT
