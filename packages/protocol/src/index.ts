// Envelope
export {
  MessageEnvelopeSchema,
  MessageTypeSchema,
  type MessageEnvelope,
  type MessageType,
} from './envelope.js';

// Capability
export {
  CapabilitySchema,
  PricingSchema,
  SlaSchema,
  type Capability,
  type JSONSchema,
  type Pricing,
  type Sla,
} from './capability.js';

// Message bodies
export {
  AnnounceBodySchema,
  DiscoverBodySchema,
  DiscoverResultBodySchema,
  TaskRequestBodySchema,
  TaskAcceptBodySchema,
  TaskRejectBodySchema,
  TaskProgressBodySchema,
  TaskResultBodySchema,
  TaskCancelBodySchema,
  ReputationReportBodySchema,
  ReputationScoreSchema,
  MessageBodySchema,
  type AnnounceBody,
  type DiscoverBody,
  type DiscoverResultBody,
  type TaskRequestBody,
  type TaskAcceptBody,
  type TaskRejectBody,
  type TaskProgressBody,
  type TaskResultBody,
  type TaskCancelBody,
  type ReputationReportBody,
  type ReputationScore,
  type MessageBody,
} from './messages.js';

// Constants
export {
  PROTOCOL_VERSION,
  DEFAULT_TTL,
  MAX_CLOCK_DRIFT_MS,
  DEFAULT_REGISTRY_PORT,
  DEFAULT_AGENT_PORT,
  REGISTRY_TARGET,
} from './constants.js';
