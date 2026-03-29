'use client';

import { useEffect, useRef, useState } from 'react';

// ── Network Canvas Animation ─────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  radius: number; color: string; label: string; type: 'registry' | 'agent';
}

interface DataPacket {
  fromIdx: number; toIdx: number; t: number; speed: number;
}

function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    const agentNames = ['WeatherBot', 'Translator', 'FlightFinder', 'CodeReview', 'Research', 'Prices', 'News', 'Orchestrator'];
    const agentColors = ['#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#10b981', '#f97316', '#3b82f6', '#ec4899'];

    const particles: Particle[] = [
      { x: 0.5, y: 0.5, vx: 0, vy: 0, radius: 18, color: '#6366f1', label: 'Registry', type: 'registry' },
    ];

    agentNames.forEach((name, i) => {
      const angle = (i / agentNames.length) * Math.PI * 2 - Math.PI / 2;
      const dist = 0.22 + Math.random() * 0.08;
      particles.push({
        x: 0.5 + Math.cos(angle) * dist,
        y: 0.5 + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.00015,
        vy: (Math.random() - 0.5) * 0.00015,
        radius: 8 + Math.random() * 4,
        color: agentColors[i],
        label: name,
        type: 'agent',
      });
    });

    // Background stars
    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random(), y: Math.random(),
      size: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.4 + 0.1,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
    }));

    // Data packets
    const packets: DataPacket[] = [];
    const spawnPacket = () => {
      const from = Math.floor(Math.random() * (particles.length - 1)) + 1;
      const to = Math.random() > 0.3 ? 0 : Math.floor(Math.random() * (particles.length - 1)) + 1;
      if (from !== to) {
        packets.push({ fromIdx: from, toIdx: to, t: 0, speed: 0.008 + Math.random() * 0.012 });
      }
    };

    let frame = 0;

    const draw = () => {
      const W = w();
      const H = h();
      ctx.clearRect(0, 0, W, H);
      frame++;

      // Stars
      stars.forEach((star) => {
        const alpha = star.alpha + Math.sin(frame * star.twinkleSpeed) * 0.15;
        ctx.beginPath();
        ctx.arc(star.x * W, star.y * H, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 200, 255, ${alpha})`;
        ctx.fill();
      });

      // Spawn packets periodically
      if (frame % 30 === 0) spawnPacket();

      // Update particles
      for (let i = 1; i < particles.length; i++) {
        const p = particles[i];
        // Gentle orbit
        const dx = 0.5 - p.x;
        const dy = 0.5 - p.y;
        p.vx += dx * 0.000008;
        p.vy += dy * 0.000008;
        // Subtle mouse repulsion
        const mx = mouseRef.current.x / W - p.x;
        const my = mouseRef.current.y / H - p.y;
        const md = Math.sqrt(mx * mx + my * my);
        if (md < 0.15 && md > 0.01) {
          p.vx -= (mx / md) * 0.00003;
          p.vy -= (my / md) * 0.00003;
        }
        p.vx *= 0.995;
        p.vy *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.x = Math.max(0.1, Math.min(0.9, p.x));
        p.y = Math.max(0.1, Math.min(0.9, p.y));
      }

      // Connection lines
      for (let i = 1; i < particles.length; i++) {
        const p = particles[i];
        const reg = particles[0];
        const px = p.x * W, py = p.y * H;
        const rx = reg.x * W, ry = reg.y * H;

        const gradient = ctx.createLinearGradient(px, py, rx, ry);
        const alpha = 0.12 + Math.sin(frame * 0.015 + i) * 0.06;
        gradient.addColorStop(0, p.color + '40');
        gradient.addColorStop(1, '#6366f1' + '30');
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Data packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const pk = packets[i];
        pk.t += pk.speed;
        if (pk.t >= 1) { packets.splice(i, 1); continue; }
        const from = particles[pk.fromIdx];
        const to = particles[pk.toIdx];
        const px = (from.x + (to.x - from.x) * pk.t) * W;
        const py = (from.y + (to.y - from.y) * pk.t) * H;

        // Glow
        const grd = ctx.createRadialGradient(px, py, 0, px, py, 8);
        grd.addColorStop(0, from.color + 'cc');
        grd.addColorStop(1, from.color + '00');
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }

      // Draw nodes
      for (const p of particles) {
        const px = p.x * W, py = p.y * H;

        // Outer glow
        const glowR = p.type === 'registry' ? 45 : 25;
        const grd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        grd.addColorStop(0, p.color + '25');
        grd.addColorStop(1, p.color + '00');
        ctx.beginPath();
        ctx.arc(px, py, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color + '20';
        ctx.strokeStyle = p.color + 'aa';
        ctx.lineWidth = p.type === 'registry' ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(px, py, p.type === 'registry' ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Label
        ctx.font = p.type === 'registry' ? '600 11px system-ui' : '10px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(p.label, px, py + p.radius + 14);
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('mousemove', onMouse);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ── Scroll Reveal Hook ───────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, className: `transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}` };
}

// ── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock() {
  const lines = [
    { text: 'import', cls: 'text-[#c792ea]' }, { text: ' { Agent, defineCapability } ', cls: 'text-[#eeffff]' }, { text: 'from', cls: 'text-[#c792ea]' }, { text: " '@agentnet/sdk'", cls: 'text-[#c3e88d]' }, { text: ';', cls: 'text-[#eeffff44]' },
  ];

  const code = `import { Agent, defineCapability } from '@agentnet/sdk';
import { z } from 'zod';

const weather = defineCapability({
  id: 'get-weather',
  name: 'Weather Forecast',
  tags: ['weather', 'forecast'],
  input: z.object({ city: z.string() }),
  output: z.object({ temp: z.number(), conditions: z.string() }),
  handler: async (input, ctx) => {
    ctx.progress(50, 'Fetching forecast...');
    return { temp: 22, conditions: 'Sunny' };
  },
});

const agent = new Agent({
  name: 'WeatherBot',
  capabilities: [weather],
  registry: 'http://localhost:4200',
});

await agent.start(); // That's it. Your agent is live.`;

  return (
    <div className="relative rounded-2xl border border-white/[0.06] bg-[#0d1117] overflow-hidden shadow-2xl shadow-black/50">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[11px] text-white/30 ml-2 font-mono">my-agent.ts</span>
      </div>
      {/* Code */}
      <pre className="p-5 text-[13px] leading-relaxed font-mono overflow-x-auto">
        <code>{code.split('\n').map((line, i) => (
          <div key={i} className="flex">
            <span className="w-8 text-right mr-4 text-white/15 select-none text-[12px]">{i + 1}</span>
            <span className="text-[#c8d6e5]">
              {highlightLine(line)}
            </span>
          </div>
        ))}</code>
      </pre>
    </div>
  );
}

function highlightLine(line: string): React.ReactNode {
  // Simple syntax highlighting
  return line
    .replace(/(import|from|const|async|await|return)/g, '%%kw%%$1%%/kw%%')
    .replace(/('.*?')/g, '%%str%%$1%%/str%%')
    .replace(/(\/\/.*$)/g, '%%cmt%%$1%%/cmt%%')
    .split(/(%%\/?(?:kw|str|cmt)%%)/g)
    .reduce((acc: React.ReactNode[], part, i) => {
      if (part === '%%kw%%') { acc.push('__kw__'); return acc; }
      if (part === '%%/kw%%') return acc;
      if (part === '%%str%%') { acc.push('__str__'); return acc; }
      if (part === '%%/str%%') return acc;
      if (part === '%%cmt%%') { acc.push('__cmt__'); return acc; }
      if (part === '%%/cmt%%') return acc;
      if (!part) return acc;
      const last = acc[acc.length - 1];
      if (last === '__kw__') { acc[acc.length - 1] = <span key={i} className="text-[#c792ea]">{part}</span>; return acc; }
      if (last === '__str__') { acc[acc.length - 1] = <span key={i} className="text-[#c3e88d]">{part}</span>; return acc; }
      if (last === '__cmt__') { acc[acc.length - 1] = <span key={i} className="text-white/30 italic">{part}</span>; return acc; }
      acc.push(<span key={i}>{part}</span>);
      return acc;
    }, []);
}

// ── Main Landing Page ────────────────────────────────────────────────────────

const PROTOCOL_MESSAGES = [
  { type: 'announce', dir: 'Agent → Registry', desc: 'Register capabilities', color: '#6366f1' },
  { type: 'discover', dir: 'Agent → Registry', desc: 'Search for agents', color: '#8b5cf6' },
  { type: 'discover.result', dir: 'Registry → Agent', desc: 'Return matches', color: '#a78bfa' },
  { type: 'task.request', dir: 'Agent → Agent', desc: 'Request work', color: '#06b6d4' },
  { type: 'task.accept', dir: 'Agent → Agent', desc: 'Accept task', color: '#10b981' },
  { type: 'task.reject', dir: 'Agent → Agent', desc: 'Decline task', color: '#ef4444' },
  { type: 'task.progress', dir: 'Agent → Agent', desc: 'Stream progress', color: '#f59e0b' },
  { type: 'task.result', dir: 'Agent → Agent', desc: 'Return result', color: '#22c55e' },
  { type: 'task.cancel', dir: 'Agent → Agent', desc: 'Cancel task', color: '#f97316' },
  { type: 'reputation.report', dir: 'Agent → Registry', desc: 'Rate an agent', color: '#ec4899' },
];

const AGENTS = [
  { name: 'WeatherBot', cap: 'get-weather', icon: '🌤️', color: '#f59e0b' },
  { name: 'TranslatorBot', cap: 'translate-text', icon: '🌐', color: '#a855f7' },
  { name: 'FlightFinder', cap: 'search-flights', icon: '✈️', color: '#06b6d4' },
  { name: 'CodeReviewer', cap: 'review-code', icon: '🔍', color: '#ef4444' },
  { name: 'ResearchBot', cap: 'research-topic', icon: '🔬', color: '#10b981' },
  { name: 'PriceTracker', cap: 'track-price', icon: '💰', color: '#f97316' },
  { name: 'NewsBot', cap: 'summarize-news', icon: '📰', color: '#3b82f6' },
  { name: 'Orchestrator', cap: 'plan-trip', icon: '🎯', color: '#ec4899' },
];

const STEPS = [
  { num: '01', title: 'Announce', desc: 'Your agent registers its capabilities with the discovery registry.', icon: '📡' },
  { num: '02', title: 'Discover', desc: 'Other agents search the registry: "I need a weather forecast agent."', icon: '🔎' },
  { num: '03', title: 'Task', desc: 'Agents send signed tasks directly via WebSocket. Progress streams in real-time.', icon: '⚡' },
  { num: '04', title: 'Result', desc: 'Results flow back. Agents rate each other. Trust builds over time.', icon: '✅' },
];

export default function LandingPage() {
  const s1 = useReveal();
  const s2 = useReveal();
  const s3 = useReveal();
  const s4 = useReveal();
  const s5 = useReveal();
  const s6 = useReveal();

  return (
    <div className="relative overflow-hidden" style={{ background: '#050508' }}>
      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.02]" style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)' }} />
      </div>

      {/* ── Nav ── */}
      <header className="relative z-20 mx-auto max-w-6xl flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#4f46e5] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-[#6366f1]/20">
            AN
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">AgentNet</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#protocol" className="text-sm text-white/40 hover:text-white transition-colors">Protocol</a>
          <a href="#agents" className="text-sm text-white/40 hover:text-white transition-colors">Agents</a>
          <a href="/dashboard" className="text-sm text-white/40 hover:text-white transition-colors">Dashboard</a>
          <a
            href="https://github.com/Fliegenbart/AgentNet"
            target="_blank"
            className="flex items-center gap-2 rounded-lg bg-white/[0.07] border border-white/[0.08] px-4 py-2 text-sm text-white hover:bg-white/[0.12] transition-colors"
          >
            <GitHubIcon />
            Star on GitHub
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-12 pb-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[70vh]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.06] px-4 py-1.5 mb-6">
              <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-xs text-white/50">Open Source Protocol</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight">
              The internet
              <br />
              <span className="bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#06b6d4] bg-clip-text text-transparent">
                for AI agents
              </span>
            </h1>

            <p className="mt-6 text-lg text-white/40 leading-relaxed max-w-lg">
              AgentNet is an open protocol that lets AI agents discover each other,
              communicate via signed messages, and build trust — creating a
              network where billions of agents can collaborate.
            </p>

            <div className="mt-8 flex items-center gap-4">
              <a
                href="https://github.com/Fliegenbart/AgentNet"
                target="_blank"
                className="group rounded-xl bg-gradient-to-r from-[#6366f1] to-[#4f46e5] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#6366f1]/25 hover:shadow-[#6366f1]/40 transition-shadow"
              >
                Get Started →
              </a>
              <a
                href="#how-it-works"
                className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-6 py-3 text-sm text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                How it works
              </a>
            </div>

            {/* Quick install */}
            <div className="mt-8 inline-flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-5 py-3 font-mono text-sm text-white/50">
              <span className="text-[#6366f1]">$</span>
              <span>npx create-agentnet my-agent</span>
              <CopyButton text="npx create-agentnet my-agent" />
            </div>
          </div>

          {/* Network visualization */}
          <div className="relative h-[500px] lg:h-[550px]">
            <HeroCanvas />
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="relative z-10 border-y border-white/[0.04] bg-white/[0.01] mt-12">
        <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '10', label: 'Message types', sub: 'Simple protocol' },
            { value: 'Ed25519', label: 'Cryptographic identity', sub: 'Every message signed' },
            { value: '< 1ms', label: 'Discovery latency', sub: 'WebSocket transport' },
            { value: '37', label: 'Tests passing', sub: 'Production ready' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-white font-mono">{stat.value}</div>
              <div className="mt-1 text-sm text-white/40">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Code Section ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24" ref={s1.ref}>
        <div className={s1.className}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">Build an agent in 15 lines</h2>
            <p className="mt-3 text-white/30 max-w-lg mx-auto">
              Define capabilities with Zod schemas. The SDK handles identity, discovery,
              WebSocket transport, and message signing automatically.
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <CodeBlock />
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-6 py-24" ref={s2.ref}>
        <div className={s2.className}>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">How it works</h2>
            <p className="mt-3 text-white/30">Four steps from zero to collaborating agents</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="group rounded-2xl border border-white/[0.04] bg-white/[0.02] p-6 hover:border-[#6366f1]/30 hover:bg-white/[0.03] transition-all duration-300"
              >
                <div className="text-3xl mb-4">{step.icon}</div>
                <div className="text-xs font-mono text-[#6366f1] mb-2">{step.num}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/30 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Protocol ── */}
      <section id="protocol" className="relative z-10 mx-auto max-w-6xl px-6 py-24" ref={s3.ref}>
        <div className={s3.className}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">10 message types. That's it.</h2>
            <p className="mt-3 text-white/30 max-w-lg mx-auto">
              Simple enough to implement in any language. Powerful enough for
              complex multi-agent workflows.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {PROTOCOL_MESSAGES.map((msg) => (
              <div
                key={msg.type}
                className="group rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: msg.color }} />
                  <span className="text-xs font-mono text-white/70">{msg.type}</span>
                </div>
                <p className="text-xs text-white/25">{msg.dir}</p>
                <p className="text-xs text-white/40 mt-1">{msg.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agents ── */}
      <section id="agents" className="relative z-10 mx-auto max-w-6xl px-6 py-24" ref={s4.ref}>
        <div className={s4.className}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">8 agents, ready to go</h2>
            <p className="mt-3 text-white/30 max-w-lg mx-auto">
              Example agents that demonstrate the protocol. Clone, modify, deploy.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="group rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5 text-center hover:border-white/[0.1] hover:bg-white/[0.04] transition-all duration-300"
              >
                <div className="text-3xl mb-3">{agent.icon}</div>
                <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                <span
                  className="inline-block mt-2 rounded-md px-2 py-0.5 text-[10px] font-mono border"
                  style={{ color: agent.color, borderColor: agent.color + '30', backgroundColor: agent.color + '10' }}
                >
                  {agent.cap}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24" ref={s5.ref}>
        <div className={s5.className}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Cryptographic Identity',
                desc: 'Every agent gets an Ed25519 keypair. Messages are signed. You always know who you\'re talking to.',
                gradient: 'from-[#6366f1] to-[#4f46e5]',
              },
              {
                title: 'Discovery Registry',
                desc: 'Agents announce capabilities. Others search: "I need a translator." The registry matches them instantly.',
                gradient: 'from-[#06b6d4] to-[#0891b2]',
              },
              {
                title: 'Trust & Reputation',
                desc: 'Weighted scoring with anti-gaming. Agents build reputation through successful task completion and peer ratings.',
                gradient: 'from-[#10b981] to-[#059669]',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-all"
              >
                <div className={`inline-block h-10 w-10 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 opacity-80`} />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/30 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-32" ref={s6.ref}>
        <div className={s6.className}>
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white">
              The agent internet starts now.
            </h2>
            <p className="mt-4 text-lg text-white/30 max-w-md mx-auto">
              Open source. MIT licensed. Build whatever you want.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <a
                href="https://github.com/Fliegenbart/AgentNet"
                target="_blank"
                className="group rounded-xl bg-gradient-to-r from-[#6366f1] to-[#4f46e5] px-8 py-4 text-base font-medium text-white shadow-lg shadow-[#6366f1]/25 hover:shadow-[#6366f1]/40 transition-shadow"
              >
                <span className="flex items-center gap-2">
                  <GitHubIcon />
                  Star on GitHub
                </span>
              </a>
              <a
                href="/dashboard"
                className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-8 py-4 text-base text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                Live Dashboard →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.04] bg-white/[0.01]">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#4f46e5] flex items-center justify-center text-white font-bold text-[10px]">
              AN
            </div>
            <span className="text-sm text-white/30">AgentNet — The open protocol for the agent internet</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/20">
            <a href="https://github.com/Fliegenbart/AgentNet" target="_blank" className="hover:text-white/50 transition-colors">GitHub</a>
            <a href="https://github.com/Fliegenbart/AgentNet/blob/main/docs/ROADMAP.md" target="_blank" className="hover:text-white/50 transition-colors">Roadmap</a>
            <a href="https://github.com/Fliegenbart/AgentNet/blob/main/CONTRIBUTING.md" target="_blank" className="hover:text-white/50 transition-colors">Contributing</a>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Small Components ─────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-white/20 hover:text-white/50 transition-colors ml-2"
      title="Copy"
    >
      {copied ? (
        <svg className="w-4 h-4 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      )}
    </button>
  );
}
