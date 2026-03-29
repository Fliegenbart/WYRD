import type { AgentInfo } from '@/lib/api';

function confidenceBadge(level: string) {
  const colors: Record<string, string> = {
    low: 'bg-yellow-500/20 text-yellow-400',
    medium: 'bg-blue-500/20 text-blue-400',
    high: 'bg-green-500/20 text-green-400',
  };
  return colors[level] ?? colors.low;
}

function reputationColor(score: number) {
  if (score >= 80) return 'var(--green)';
  if (score >= 60) return 'var(--yellow)';
  return 'var(--red)';
}

export function AgentCard({ agent }: { agent: AgentInfo }) {
  return (
    <div className="animate-slide-up rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-all hover:bg-[var(--bg-card-hover)] hover:border-[var(--accent)]/30">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {agent.name ?? 'Unnamed Agent'}
          </h3>
          <p className="mt-0.5 text-xs font-mono text-[var(--text-dim)]">
            {agent.agentId.slice(0, 16)}...
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="text-2xl font-bold"
            style={{ color: reputationColor(agent.reputation.overall) }}
          >
            {Math.round(agent.reputation.overall)}
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${confidenceBadge(agent.reputation.confidenceLevel)}`}
          >
            {agent.reputation.confidenceLevel}
          </span>
        </div>
      </div>

      {agent.description && (
        <p className="mt-2 text-sm text-[var(--text-dim)]">{agent.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {agent.capabilities.map((cap) => (
          <span
            key={cap.id}
            className="rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)] border border-[var(--accent)]/20"
          >
            {cap.id}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-dim)]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--green)]" />
          Online
        </span>
        <span>{agent.capabilities.length} capabilities</span>
        <span>{agent.reputation.totalTasks} tasks</span>
      </div>
    </div>
  );
}
