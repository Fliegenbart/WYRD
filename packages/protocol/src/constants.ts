/** Current protocol version */
export const PROTOCOL_VERSION = 1 as const;

/** Default TTL for agent announcements in seconds */
export const DEFAULT_TTL = 3600;

/** Maximum allowed clock drift for signed requests (ms) */
export const MAX_CLOCK_DRIFT_MS = 30_000;

/** Default registry port */
export const DEFAULT_REGISTRY_PORT = 4200;

/** Default agent WebSocket port */
export const DEFAULT_AGENT_PORT = 4201;

/** Registry message target */
export const REGISTRY_TARGET = 'registry';
