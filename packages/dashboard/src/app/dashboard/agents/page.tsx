import { fetchAgents, type AgentInfo } from '@/lib/api';
import { AgentCard } from '@/components/agent-card';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  let agents: AgentInfo[] = [];
  let error = '';

  try {
    agents = await fetchAgents();
  } catch {
    error = 'Cannot connect to registry.';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Directory</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          All agents registered on the network
        </p>
      </div>

      {error ? (
        <p className="text-center text-[var(--text-dim)] py-12">{error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {agents.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
          {agents.length === 0 && (
            <p className="text-center text-[var(--text-dim)] py-12 col-span-2">
              No agents online.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
