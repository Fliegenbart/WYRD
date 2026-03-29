FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/reputation/package.json packages/reputation/
COPY packages/registry/package.json packages/registry/

RUN pnpm install --frozen-lockfile

COPY packages/protocol/ packages/protocol/
COPY packages/reputation/ packages/reputation/
COPY packages/registry/ packages/registry/

RUN pnpm --filter @agentnet/protocol build && \
    pnpm --filter @agentnet/reputation build && \
    pnpm --filter @agentnet/registry build

WORKDIR /app/packages/registry
EXPOSE 4200
CMD ["pnpm", "dev"]
