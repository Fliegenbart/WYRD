'use client';

import { NetworkGraph } from '@/components/network-graph';
import type { AgentInfo } from '@/lib/api';

export function NetworkGraphWrapper({ agents }: { agents: AgentInfo[] }) {
  return <NetworkGraph agents={agents} />;
}
