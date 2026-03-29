import { fetchAgents, fetchStats, type AgentInfo, type NetworkStats } from '@/lib/api';
import { StatCard } from '@/components/stat-card';
import { AgentCard } from '@/components/agent-card';
import { NetworkGraphWrapper } from './network-wrapper';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let agents: AgentInfo[] = [];
  let stats: NetworkStats = { agents: { total: 0, online: 0 }, capabilities: 0 };
  let error = '';

  try {
    [agents, stats] = await Promise.all([fetchAgents(), fetchStats()]);
  } catch (e) {
    error = 'Cannot connect to registry. Make sure the AgentNet registry is running on port 4200.';
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔌</div>
          <h2 className="text-xl font-semibold text-white mb-2">Registry Offline</h2>
          <p className="text-[var(--text-dim)] mb-4">{error}</p>
          <pre className="rounded-lg bg-[var(--bg-card)] border border-[var(--border)] p-4 text-sm text-left text-[var(--accent)]">
            pnpm --filter @agentnet/demo run start
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Network Overview</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          Real-time view of the AgentNet agent network
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Agents Online"
          value={stats.agents.online}
          subvalue={`${stats.agents.total} total registered`}
          color="var(--green)"
        />
        <StatCard
          label="Capabilities"
          value={stats.capabilities}
          subvalue="across all agents"
          color="var(--accent)"
        />
        <StatCard
          label="Network Health"
          value={stats.agents.online > 0 ? 'Healthy' : 'Offline'}
          color={stats.agents.online > 0 ? 'var(--green)' : 'var(--red)'}
        />
        <StatCard
          label="Protocol"
          value="v1"
          subvalue="10 message types"
          color="var(--cyan)"
        />
      </div>

      <NetworkGraphWrapper agents={agents} />

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Active Agents</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {agents.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
        </div>
        {agents.length === 0 && (
          <p className="text-center text-[var(--text-dim)] py-8">
            No agents online. Start some agents to see them here.
          </p>
        )}
      </div>
    </div>
  );
}
