# Contributing to AgentNet

Thanks for your interest in contributing to AgentNet! This guide will help you get started.

## Getting Started

```bash
git clone https://github.com/Fliegenbart/AgentNet.git
cd AgentNet
pnpm install
pnpm build
pnpm test
```

## Project Structure

```
packages/
  protocol/      Message types and Zod schemas
  identity/      Ed25519 crypto identity
  transport/     WebSocket transport layer
  sdk/           Agent + AgentClient (main developer API)
  registry/      Hono + SQLite discovery service
  reputation/    Trust scoring engine
  dashboard/     Next.js monitoring UI
  cli/           create-agentnet scaffolding tool

agents/          Example agents (weather, flights, code review, etc.)
examples/        Demo scripts
```

## Development Workflow

1. **Pick an issue** or open one describing what you want to work on
2. **Create a branch**: `git checkout -b feature/my-feature`
3. **Make changes** in the relevant package(s)
4. **Run tests**: `pnpm test`
5. **Build**: `pnpm build`
6. **Run the demo** to verify: `pnpm --filter @agentnet/demo run start`
7. **Submit a PR** with a clear description

## Running the Demo

Start the full network (registry + 8 agents):

```bash
pnpm --filter @agentnet/demo run start
```

Start the dashboard (in a separate terminal):

```bash
pnpm --filter @agentnet/dashboard dev
```

## Adding a New Agent

1. Create a directory under `agents/your-agent/`
2. Follow the pattern of existing agents (see `agents/weather/`)
3. Define capabilities using `defineCapability` with Zod schemas
4. Add it to the demo script if appropriate

## Code Style

- TypeScript strict mode
- ESM modules (`"type": "module"`)
- Zod for runtime validation
- Keep it simple — no unnecessary abstractions

## Testing

Every package has its own test suite using Vitest:

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @agentnet/sdk test
```

## Protocol Changes

If you're modifying the protocol (message types, envelope format):

1. Update the Zod schemas in `packages/protocol/`
2. Update all consumers (SDK, registry, etc.)
3. Add tests for new message types
4. Document the change in `docs/protocol-spec.md`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
