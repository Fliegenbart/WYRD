export { Agent } from './agent.js';
export { AgentClient, type AgentClientConfig } from './client.js';
export { defineCapability } from './capability.js';
export { wyrdMiddleware, type WyrdMiddlewareConfig } from './middleware.js';

export type {
  AgentConfig,
  CapabilityDefinition,
  CapabilityHandler,
  TaskContext,
  TaskLogger,
  DiscoverOptions,
  DiscoveredAgent,
  TaskStreamEvent,
} from './types.js';
