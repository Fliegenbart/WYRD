export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] backdrop-blur-md" style={{ background: 'rgba(7,7,10,0.8)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center border border-[var(--thread)]/30" style={{ background: 'linear-gradient(135deg, rgba(212,168,67,0.1), rgba(91,91,214,0.08))' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="var(--thread)" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4 L8 20 L12 8 L16 20 L20 4" />
                </svg>
              </div>
              <span className="tracking-[0.15em] font-semibold text-[var(--ash)]" style={{ fontFamily: "'Cinzel', serif", fontSize: '0.95rem' }}>WYRD</span>
            </a>
            <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border border-[var(--thread)]/20 bg-[var(--thread)]/[0.06]" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--thread)' }}>
              Dashboard
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NavLink href="/dashboard" label="Overview" />
            <NavLink href="/dashboard/agents" label="Agents" />
            <NavLink href="/dashboard/network" label="Network" />
            <NavLink href="/dashboard/playground" label="Playground" />
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md px-3 py-1.5 text-sm hover:text-[var(--ash)] hover:bg-[var(--void-card)] transition-colors"
      style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)' }}
    >
      {label}
    </a>
  );
}
