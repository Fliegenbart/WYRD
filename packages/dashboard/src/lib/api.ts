const REGISTRY_URL = process.env.NEXT_PUBLIC_REGISTRY_URL ?? 'http://localhost:4200';

export interface AgentInfo {
  agentId: string;
  name: string | null;
  description: string | null;
  endpoint: string;
  capabilities: CapabilityInfo[];
  reputation: {
    overall: number;
    totalTasks: number;
    confidenceLevel: 'low' | 'medium' | 'high';
  };
}

export interface CapabilityInfo {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface NetworkStats {
  agents: { total: number; online: number };
  capabilities: number;
}

export interface ReputationDetails {
  overall: number;
  components: {
    taskSuccess: number;
    ratings: number;
    speed: number;
    longevity: number;
    volume: number;
    consistency: number;
  };
  confidenceLevel: 'low' | 'medium' | 'high';
}

export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch(`${REGISTRY_URL}/v1/discover?limit=100`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch agents');
  const data = await res.json();
  return data.agents;
}

export async function fetchAgent(id: string): Promise<AgentInfo & { meta: any }> {
  const res = await fetch(`${REGISTRY_URL}/v1/agents/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Agent not found');
  return res.json();
}

export async function fetchStats(): Promise<NetworkStats> {
  const res = await fetch(`${REGISTRY_URL}/v1/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchReputation(agentId: string): Promise<ReputationDetails> {
  const res = await fetch(`${REGISTRY_URL}/v1/reputation/${agentId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch reputation');
  return res.json();
}

export async function fetchCapabilities(): Promise<{ capabilities: CapabilityInfo[] }> {
  const res = await fetch(`${REGISTRY_URL}/v1/capabilities`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch capabilities');
  return res.json();
}
