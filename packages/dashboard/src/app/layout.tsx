import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WYRD — The open coordination layer for the agent internet',
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
