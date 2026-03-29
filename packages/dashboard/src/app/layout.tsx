import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentNet Dashboard',
  description: 'Live monitoring dashboard for the AgentNet agent network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white font-bold text-sm">
                AN
              </div>
              <span className="text-lg font-semibold text-white">AgentNet</span>
              <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wider">
                Dashboard
              </span>
            </div>
            <div className="flex items-center gap-1">
              <NavLink href="/" label="Overview" />
              <NavLink href="/agents" label="Agents" />
              <NavLink href="/network" label="Network" />
              <NavLink href="/playground" label="Playground" />
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-card)] transition-colors"
    >
      {label}
    </a>
  );
}
