'use client';

import { useState } from 'react';

const REGISTRY_URL = 'http://localhost:4200';

interface Agent {
  agentId: string;
  name: string | null;
  capabilities: { id: string; name: string; description: string }[];
}

export default function PlaygroundPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedCap, setSelectedCap] = useState('');
  const [input, setInput] = useState('{}');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discovered, setDiscovered] = useState(false);

  async function discover() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${REGISTRY_URL}/v1/discover?limit=50`);
      if (!res.ok) throw new Error('Registry offline');
      const data = await res.json();
      setAgents(data.agents);
      setDiscovered(true);
      if (data.agents.length > 0) {
        setSelectedAgent(data.agents[0]);
        setSelectedCap(data.agents[0].capabilities[0]?.id ?? '');
        setInput(getDefaultInput(data.agents[0].capabilities[0]?.id ?? ''));
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function sendTask() {
    if (!selectedAgent || !selectedCap) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const parsed = JSON.parse(input);
      // Use registry to get endpoint, then send via HTTP for simplicity
      const agentRes = await fetch(`${REGISTRY_URL}/v1/agents/${selectedAgent.agentId}`);
      if (!agentRes.ok) throw new Error('Agent not found');

      // For the playground, we'll call the registry as a proxy concept
      // In production, this would go through the SDK
      const taskRes = await fetch(`${REGISTRY_URL}/v1/agents/${selectedAgent.agentId}`);
      const agentData = await taskRes.json();

      setResult({
        agentId: selectedAgent.agentId,
        agentName: selectedAgent.name,
        capability: selectedCap,
        input: parsed,
        note: `Task would be sent to ${selectedAgent.name} at ${agentData.endpoint}. Use the SDK for real task execution:`,
        code: `const result = await client.task('${selectedAgent.agentId.slice(0, 16)}...', '${selectedCap}', ${input});`,
      });
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  function getDefaultInput(capId: string): string {
    const defaults: Record<string, any> = {
      'get-weather': { city: 'Tokyo', units: 'celsius' },
      'translate-text': { text: 'hello', from: 'en', to: 'ja' },
      'search-flights': { origin: 'SFO', destination: 'NRT', date: '2026-05-01', passengers: 1 },
      'review-code': { code: 'function foo() { var x: any = eval(input); console.log(x); }', language: 'typescript' },
      'research-topic': { topic: 'AI agents', depth: 'brief' },
      'track-price': { product: 'Mechanical Keyboard' },
      'summarize-news': { topic: 'artificial intelligence', count: 3 },
      'plan-trip': { destination: 'Tokyo', language: 'ja' },
      'multi-task': { task: 'research', subtasks: [] },
    };
    return JSON.stringify(defaults[capId] ?? {}, null, 2);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Playground</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          Discover agents and send tasks interactively
        </p>
      </div>

      {!discovered ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <button
            onClick={discover}
            disabled={loading}
            className="rounded-lg bg-[var(--accent)] px-6 py-3 text-white font-medium hover:bg-[var(--accent)]/80 transition-colors disabled:opacity-50"
          >
            {loading ? 'Discovering...' : 'Discover Agents'}
          </button>
          {error && <p className="text-[var(--red)] text-sm">{error}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Config */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <label className="text-sm text-[var(--text-dim)] uppercase tracking-wider">Agent</label>
              <select
                value={selectedAgent?.agentId ?? ''}
                onChange={(e) => {
                  const a = agents.find((ag) => ag.agentId === e.target.value);
                  setSelectedAgent(a ?? null);
                  const cap = a?.capabilities[0]?.id ?? '';
                  setSelectedCap(cap);
                  setInput(getDefaultInput(cap));
                  setResult(null);
                }}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
              >
                {agents.map((a) => (
                  <option key={a.agentId} value={a.agentId}>
                    {a.name ?? a.agentId.slice(0, 16)} — {a.capabilities.map((c) => c.id).join(', ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <label className="text-sm text-[var(--text-dim)] uppercase tracking-wider">Capability</label>
              <select
                value={selectedCap}
                onChange={(e) => {
                  setSelectedCap(e.target.value);
                  setInput(getDefaultInput(e.target.value));
                  setResult(null);
                }}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
              >
                {selectedAgent?.capabilities.map((cap) => (
                  <option key={cap.id} value={cap.id}>
                    {cap.id} — {cap.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <label className="text-sm text-[var(--text-dim)] uppercase tracking-wider">Input (JSON)</label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={6}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white font-mono text-sm"
              />
            </div>

            <button
              onClick={sendTask}
              disabled={loading || !selectedAgent}
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-white font-medium hover:bg-[var(--accent)]/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Task'}
            </button>

            {error && <p className="text-[var(--red)] text-sm">{error}</p>}
          </div>

          {/* Right: Result */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <label className="text-sm text-[var(--text-dim)] uppercase tracking-wider">Result</label>
            {result ? (
              <pre className="mt-3 overflow-auto rounded-lg bg-[var(--bg)] border border-[var(--border)] p-4 text-sm text-[var(--text)] font-mono max-h-[500px]">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <p className="mt-4 text-center text-[var(--text-dim)] py-16">
                Select an agent and send a task to see results here
              </p>
            )}
          </div>
        </div>
      )}

      {/* Agent cards */}
      {discovered && agents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Discovered Agents ({agents.length})</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {agents.map((a) => (
              <div key={a.agentId} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 hover:border-[var(--accent)]/30 transition-colors">
                <p className="font-medium text-white text-sm">{a.name}</p>
                <p className="text-xs font-mono text-[var(--text-dim)] mt-0.5">{a.agentId.slice(0, 12)}...</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.capabilities.map((cap) => (
                    <span key={cap.id} className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                      {cap.id}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
