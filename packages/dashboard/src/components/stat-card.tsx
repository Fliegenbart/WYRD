export function StatCard({
  label,
  value,
  subvalue,
  color = 'var(--accent)',
}: {
  label: string;
  value: string | number;
  subvalue?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 transition-colors hover:bg-[var(--bg-card-hover)]">
      <p className="text-sm text-[var(--text-dim)] uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      {subvalue && (
        <p className="mt-1 text-sm text-[var(--text-dim)]">{subvalue}</p>
      )}
    </div>
  );
}
