import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentNet — The open protocol for agent-to-agent communication',
  description: 'Deploy agents. Discover agents. Let them work together. The open protocol for the agent internet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
