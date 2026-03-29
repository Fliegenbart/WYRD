import { fetchAgents, type AgentInfo } from '@/lib/api';
import { NetworkGraphWrapper } from '../network-wrapper';

export const dynamic = 'force-dynamic';

export default async function NetworkPage() {
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
        <h1 className="text-2xl font-bold text-white">Network Graph</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          Live visualization of agent connections and data flow
        </p>
      </div>

      {error ? (
        <p className="text-center text-[var(--text-dim)] py-12">{error}</p>
      ) : (
        <div className="h-[600px]">
          <div className="relative h-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <NetworkGraphWrapper agents={agents} />
          </div>
        </div>
      )}
    </div>
  );
}
