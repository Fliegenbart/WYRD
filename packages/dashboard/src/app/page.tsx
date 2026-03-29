'use client';

import { useEffect, useRef, useState } from 'react';

// ── WYRD Network Canvas ──────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  radius: number; color: string; label: string; type: 'registry' | 'agent';
}

function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1, y: -1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    // Agent definitions — fixed orbital positions, different distances
    const agentDefs = [
      { name: 'Weather',    color: '#d4a843', orbit: 0.32, speed: 0.0008, offset: 0.0, r: 10 },
      { name: 'Translator', color: '#7b7bea', orbit: 0.28, speed: -0.0006, offset: 1.2, r: 9 },
      { name: 'Flights',    color: '#00d4aa', orbit: 0.35, speed: 0.0005, offset: 2.5, r: 8 },
      { name: 'Security',   color: '#e5484d', orbit: 0.22, speed: -0.001, offset: 3.8, r: 11 },
      { name: 'Research',   color: '#5b5bd6', orbit: 0.30, speed: 0.0007, offset: 5.0, r: 9 },
      { name: 'News',       color: '#06b6d4', orbit: 0.26, speed: -0.0009, offset: 0.8, r: 8 },
    ];

    const CX = 0.5, CY = 0.48;

    // Stars
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random(), y: Math.random(),
      size: Math.random() * 1.2 + 0.3,
      alpha: Math.random() * 0.25 + 0.05,
      speed: Math.random() * 0.012 + 0.003,
    }));

    // Collaboration events: two agents send data to center → result bursts out
    interface CollabEvent {
      agentA: number; agentB: number;
      phase: number; // 0→1: converge, 1→2: burst
      startFrame: number;
    }
    const collabs: CollabEvent[] = [];
    let nextCollab = 120;

    // Result bursts from collaboration
    interface Burst {
      x: number; y: number;
      age: number; maxAge: number;
      color: string;
    }
    const bursts: Burst[] = [];

    // Ambient packets flowing between agents
    interface Packet {
      fromIdx: number; toIdx: number;
      t: number; speed: number;
    }
    const packets: Packet[] = [];

    let frame = 0;

    const draw = () => {
      const W = w();
      const H = h();
      ctx.clearRect(0, 0, W, H);
      frame++;

      // Stars
      for (const star of stars) {
        const a = star.alpha + Math.sin(frame * star.speed) * 0.1;
        ctx.beginPath();
        ctx.arc(star.x * W, star.y * H, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 190, 220, ${a})`;
        ctx.fill();
      }

      // Calculate agent positions (fixed orbits, no shrinking)
      const agentPositions = agentDefs.map((a, i) => {
        const angle = a.offset + frame * a.speed;
        // Mouse influence: slight push away
        const mx = mouseRef.current.x >= 0 ? mouseRef.current.x / W : -1;
        const my = mouseRef.current.y >= 0 ? mouseRef.current.y / H : -1;
        let px = CX + Math.cos(angle) * a.orbit;
        let py = CY + Math.sin(angle) * a.orbit;
        if (mx >= 0) {
          const dx = px - mx, dy = py - my;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 0.12 && d > 0.01) {
            px += (dx / d) * 0.008;
            py += (dy / d) * 0.008;
          }
        }
        return { x: px, y: py, ...a, idx: i };
      });

      // Spawn ambient packets
      if (frame % 40 === 0) {
        const a = Math.floor(Math.random() * agentDefs.length);
        const b = Math.floor(Math.random() * agentDefs.length);
        if (a !== b) packets.push({ fromIdx: a, toIdx: b, t: 0, speed: 0.012 + Math.random() * 0.008 });
      }

      // Spawn collaboration events periodically
      if (frame >= nextCollab) {
        const a = Math.floor(Math.random() * agentDefs.length);
        let b = Math.floor(Math.random() * agentDefs.length);
        while (b === a) b = Math.floor(Math.random() * agentDefs.length);
        collabs.push({ agentA: a, agentB: b, phase: 0, startFrame: frame });
        nextCollab = frame + 180 + Math.floor(Math.random() * 120);
      }

      // Draw orbital paths (very subtle)
      for (const a of agentDefs) {
        ctx.beginPath();
        ctx.ellipse(CX * W, CY * H, a.orbit * W, a.orbit * H, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(91, 91, 214, 0.04)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw connection threads between nearby agents
      for (let i = 0; i < agentPositions.length; i++) {
        const a = agentPositions[i];
        for (let j = i + 1; j < agentPositions.length; j++) {
          const b = agentPositions[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.35) {
            const alpha = (0.35 - dist) / 0.35 * 0.1;
            ctx.beginPath();
            ctx.moveTo(a.x * W, a.y * H);
            ctx.lineTo(b.x * W, b.y * H);
            ctx.strokeStyle = `rgba(212, 168, 67, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
        // Thread to center
        ctx.beginPath();
        ctx.moveTo(a.x * W, a.y * H);
        ctx.lineTo(CX * W, CY * H);
        const cAlpha = 0.04 + Math.sin(frame * 0.01 + i) * 0.02;
        ctx.strokeStyle = `rgba(91, 91, 214, ${cAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw ambient packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const pk = packets[i];
        pk.t += pk.speed;
        if (pk.t >= 1) { packets.splice(i, 1); continue; }
        const from = agentPositions[pk.fromIdx];
        const to = agentPositions[pk.toIdx];
        const px = (from.x + (to.x - from.x) * pk.t) * W;
        const py = (from.y + (to.y - from.y) * pk.t) * H;

        // Packet glow
        const grd = ctx.createRadialGradient(px, py, 0, px, py, 8);
        grd.addColorStop(0, 'rgba(212, 168, 67, 0.6)');
        grd.addColorStop(1, 'rgba(212, 168, 67, 0)');
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#d4a843';
        ctx.fill();
      }

      // Process collaboration events
      for (let i = collabs.length - 1; i >= 0; i--) {
        const ev = collabs[i];
        const elapsed = frame - ev.startFrame;
        const duration = 120; // frames for full event

        if (elapsed > duration) { collabs.splice(i, 1); continue; }

        const t = elapsed / duration;
        const a = agentPositions[ev.agentA];
        const b = agentPositions[ev.agentB];

        if (t < 0.5) {
          // Phase 1: Two beams converge from agents toward center
          const beamT = t / 0.5;
          // Beam from A to center
          const ax = (a.x + (CX - a.x) * beamT) * W;
          const ay = (a.y + (CY - a.y) * beamT) * H;
          const bx = (b.x + (CX - b.x) * beamT) * W;
          const by = (b.y + (CY - b.y) * beamT) * H;

          // Draw beam trails
          ctx.beginPath();
          ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(ax, ay);
          ctx.strokeStyle = a.color + 'aa';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(b.x * W, b.y * H);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = b.color + 'aa';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Beam heads
          for (const [px, py, col] of [[ax, ay, a.color], [bx, by, b.color]] as [number, number, string][]) {
            const g = ctx.createRadialGradient(px, py, 0, px, py, 12);
            g.addColorStop(0, col + 'dd');
            g.addColorStop(1, col + '00');
            ctx.beginPath();
            ctx.arc(px, py, 12, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }
        } else {
          // Phase 2: Burst at center → result emerges
          const burstT = (t - 0.5) / 0.5;

          if (burstT < 0.1 && bursts.length < 20) {
            // Spawn burst particles
            for (let p = 0; p < 6; p++) {
              const angle = Math.random() * Math.PI * 2;
              bursts.push({
                x: CX * W + Math.cos(angle) * burstT * 60,
                y: CY * H + Math.sin(angle) * burstT * 60,
                age: 0, maxAge: 40 + Math.random() * 30,
                color: '#d4a843',
              });
            }
          }

          // Central glow
          const glowSize = 30 + burstT * 20;
          const glowAlpha = (1 - burstT) * 0.4;
          const g = ctx.createRadialGradient(CX * W, CY * H, 0, CX * W, CY * H, glowSize);
          g.addColorStop(0, `rgba(212, 168, 67, ${glowAlpha})`);
          g.addColorStop(0.5, `rgba(91, 91, 214, ${glowAlpha * 0.5})`);
          g.addColorStop(1, 'rgba(212, 168, 67, 0)');
          ctx.beginPath();
          ctx.arc(CX * W, CY * H, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();

          // Result label
          if (burstT > 0.3) {
            const labelAlpha = Math.min(1, (burstT - 0.3) / 0.3) * (1 - Math.max(0, (burstT - 0.7) / 0.3));
            ctx.font = "600 10px 'Outfit', system-ui";
            ctx.fillStyle = `rgba(212, 168, 67, ${labelAlpha})`;
            ctx.textAlign = 'center';
            ctx.fillText('✓ result', CX * W, CY * H - 25);
          }
        }
      }

      // Draw burst particles
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.age++;
        if (b.age > b.maxAge) { bursts.splice(i, 1); continue; }
        const life = 1 - b.age / b.maxAge;
        // Move outward
        const angle = Math.atan2(b.y - CY * H, b.x - CX * W);
        b.x += Math.cos(angle) * 1.5;
        b.y += Math.sin(angle) * 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2 * life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 168, 67, ${life * 0.6})`;
        ctx.fill();
      }

      // Draw center node (WYRD)
      const cx = CX * W, cy = CY * H;
      const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
      centerGlow.addColorStop(0, 'rgba(91, 91, 214, 0.12)');
      centerGlow.addColorStop(1, 'rgba(91, 91, 214, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx.fillStyle = centerGlow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(91, 91, 214, 0.12)';
      ctx.strokeStyle = 'rgba(91, 91, 214, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      ctx.font = "600 11px 'Cinzel', serif";
      ctx.fillStyle = '#d4a843';
      ctx.textAlign = 'center';
      ctx.fillText('WYRD', cx, cy + 28);

      // Draw agent nodes
      for (const a of agentPositions) {
        const ax = a.x * W, ay = a.y * H;

        // Glow
        const grd = ctx.createRadialGradient(ax, ay, 0, ax, ay, 20);
        grd.addColorStop(0, a.color + '18');
        grd.addColorStop(1, a.color + '00');
        ctx.beginPath();
        ctx.arc(ax, ay, 20, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(ax, ay, a.r, 0, Math.PI * 2);
        ctx.fillStyle = a.color + '15';
        ctx.strokeStyle = a.color + '77';
        ctx.lineWidth = 1.2;
        ctx.fill();
        ctx.stroke();

        // Core
        ctx.beginPath();
        ctx.arc(ax, ay, 3, 0, Math.PI * 2);
        ctx.fillStyle = a.color;
        ctx.fill();

        // Label
        ctx.font = "400 9px 'Outfit', system-ui";
        ctx.fillStyle = 'rgba(237,237,239,0.45)';
        ctx.textAlign = 'center';
        ctx.fillText(a.name, ax, ay + a.r + 14);
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouseRef.current = { x: -1, y: -1 }; };
    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ── Scroll Reveal ────────────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, className: `transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}` };
}

// ── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock() {
  const code = `import { Agent, defineCapability } from '@wyrd/sdk';
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
  registry: 'https://wyrd.dev',
});

await agent.start(); // Your agent joins the network.`;

  return (
    <div className="relative rounded-2xl border border-[var(--border)] bg-[#0a0a12] overflow-hidden shadow-2xl shadow-black/60">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[var(--norn-red)]" />
          <div className="w-3 h-3 rounded-full bg-[var(--thread)]" />
          <div className="w-3 h-3 rounded-full bg-[var(--rune)]" />
        </div>
        <span className="text-[11px] text-[var(--stone)] ml-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>agent.ts</span>
      </div>
      <pre className="p-5 text-[13px] leading-relaxed overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <code>{code.split('\n').map((line, i) => (
          <div key={i} className="flex">
            <span className="w-8 text-right mr-4 select-none text-[12px]" style={{ color: 'var(--stone)', opacity: 0.4 }}>{i + 1}</span>
            <span style={{ color: 'var(--ash)', opacity: 0.85 }}>{highlightLine(line)}</span>
          </div>
        ))}</code>
      </pre>
    </div>
  );
}

function highlightLine(line: string): React.ReactNode {
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
      if (last === '__kw__') { acc[acc.length - 1] = <span key={i} style={{ color: 'var(--fate-light)' }}>{part}</span>; return acc; }
      if (last === '__str__') { acc[acc.length - 1] = <span key={i} style={{ color: 'var(--rune)' }}>{part}</span>; return acc; }
      if (last === '__cmt__') { acc[acc.length - 1] = <span key={i} style={{ color: 'var(--stone)', fontStyle: 'italic' }}>{part}</span>; return acc; }
      acc.push(<span key={i}>{part}</span>);
      return acc;
    }, []);
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PROTOCOL = [
  { type: 'announce', dir: 'Agent → Registry', desc: 'Register capabilities', color: 'var(--fate)' },
  { type: 'discover', dir: 'Agent → Registry', desc: 'Search for agents', color: 'var(--fate-light)' },
  { type: 'discover.result', dir: 'Registry → Agent', desc: 'Return matches', color: 'var(--fate-light)' },
  { type: 'task.request', dir: 'Agent → Agent', desc: 'Request work', color: 'var(--thread)' },
  { type: 'task.accept', dir: 'Agent → Agent', desc: 'Accept task', color: 'var(--rune)' },
  { type: 'task.reject', dir: 'Agent → Agent', desc: 'Decline task', color: 'var(--norn-red)' },
  { type: 'task.progress', dir: 'Agent → Agent', desc: 'Stream progress', color: 'var(--thread-light)' },
  { type: 'task.result', dir: 'Agent → Agent', desc: 'Return result', color: 'var(--rune)' },
  { type: 'task.cancel', dir: 'Agent → Agent', desc: 'Cancel task', color: 'var(--norn-red)' },
  { type: 'reputation.report', dir: 'Agent → Registry', desc: 'Rate an agent', color: 'var(--thread)' },
];

const AGENTS = [
  { name: 'WeatherBot', cap: 'get-weather', icon: '01' },
  { name: 'TranslatorBot', cap: 'translate-text', icon: '02' },
  { name: 'FlightFinder', cap: 'search-flights', icon: '03' },
  { name: 'CodeReviewer', cap: 'review-code', icon: '04' },
  { name: 'ResearchBot', cap: 'research-topic', icon: '05' },
  { name: 'PriceTracker', cap: 'track-price', icon: '06' },
  { name: 'NewsBot', cap: 'summarize-news', icon: '07' },
  { name: 'Orchestrator', cap: 'plan-trip', icon: '08' },
];

const STEPS = [
  { num: 'I', title: 'Announce', desc: 'Your agent weaves itself into the network, declaring its capabilities to the registry.' },
  { num: 'II', title: 'Discover', desc: 'Other agents search for allies: "I need a translator." The registry matches fates.' },
  { num: 'III', title: 'Task', desc: 'Agents send cryptographically signed tasks directly via WebSocket. Progress streams in real-time.' },
  { num: 'IV', title: 'Trust', desc: 'Results flow back. Agents build reputation through completion. The web of fate strengthens.' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const s1 = useReveal();
  const s2 = useReveal();
  const s3 = useReveal();
  const s4 = useReveal();
  const s5 = useReveal();
  const s6 = useReveal();

  return (
    <div className="relative overflow-hidden" style={{ background: 'var(--void)' }}>
      {/* Ambient gradients */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-30%] left-[10%] w-[700px] h-[700px] rounded-full opacity-[0.025]" style={{ background: 'radial-gradient(circle, var(--fate), transparent 60%)' }} />
        <div className="absolute bottom-[-20%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.02]" style={{ background: 'radial-gradient(circle, var(--thread), transparent 60%)' }} />
      </div>

      {/* ── Nav ── */}
      <header className="relative z-20 mx-auto max-w-6xl flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-4">
          <WyrdMark />
        </div>
        <div className="flex items-center gap-8">
          <a href="#protocol" className="text-sm text-[var(--stone)] hover:text-[var(--ash)] transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }}>Protocol</a>
          <a href="#agents" className="text-sm text-[var(--stone)] hover:text-[var(--ash)] transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }}>Agents</a>
          <a href="/dashboard" className="text-sm text-[var(--stone)] hover:text-[var(--ash)] transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }}>Dashboard</a>
          <a
            href="https://github.com/Fliegenbart/wyrd"
            target="_blank"
            className="flex items-center gap-2 rounded-lg border border-[var(--border-light)] bg-[var(--void-light)] px-4 py-2 text-sm text-[var(--ash)] hover:border-[var(--thread)]/40 hover:text-[var(--thread)] transition-all"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-8 pb-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center" style={{ minHeight: '72vh' }}>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--thread)]/20 bg-[var(--thread)]/[0.04] px-4 py-1.5 mb-8">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--thread)]" style={{ animation: 'thread-pulse 2s ease-in-out infinite' }} />
              <span className="text-xs text-[var(--thread)]" style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>Open Source Protocol</span>
            </div>

            <h1 className="text-[3.5rem] lg:text-[4.2rem] leading-[1.05] tracking-tight" style={{ fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
              <span className="text-[var(--ash)]">The fate of</span>
              <br />
              <span style={{ background: 'linear-gradient(135deg, var(--thread), var(--thread-light), var(--fate-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                every agent
              </span>
              <br />
              <span className="text-[var(--ash)]">is woven here.</span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed max-w-lg" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone-light)' }}>
              WYRD is the open coordination layer for the agent internet.
              Discover. Communicate. Build trust. Let agents weave
              their fates together.
            </p>

            <div className="mt-10 flex items-center gap-4">
              <a
                href="https://github.com/Fliegenbart/wyrd"
                target="_blank"
                className="rounded-xl px-7 py-3.5 text-sm font-medium text-[var(--void)] transition-all hover:shadow-lg"
                style={{ fontFamily: "'Outfit', sans-serif", background: 'linear-gradient(135deg, var(--thread), var(--thread-light))', boxShadow: '0 4px 24px var(--thread-glow)' }}
              >
                Get Started
              </a>
              <a
                href="#how-it-works"
                className="rounded-xl border border-[var(--border-light)] px-7 py-3.5 text-sm transition-all hover:border-[var(--fate)]/30 hover:bg-[var(--void-light)]"
                style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone-light)' }}
              >
                How it works
              </a>
            </div>

            <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--void-light)] px-5 py-3 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--stone)' }}>
              <span style={{ color: 'var(--thread)' }}>$</span>
              <span>npx create-wyrd my-agent</span>
              <CopyButton text="npx create-wyrd my-agent" />
            </div>
          </div>

          <div className="relative h-[520px] lg:h-[580px]">
            <HeroCanvas />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative z-10 border-y border-[var(--border)] mt-8" style={{ background: 'var(--void-light)' }}>
        <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '10', label: 'Message types' },
            { value: 'Ed25519', label: 'Signed identity' },
            { value: 'WebSocket', label: 'Real-time transport' },
            { value: 'MIT', label: 'Open source' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-xl font-semibold" style={{ fontFamily: "'Cinzel', serif", color: 'var(--thread)' }}>{stat.value}</div>
              <div className="mt-1 text-xs tracking-wide" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Code ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-28" ref={s1.ref}>
        <div className={s1.className}>
          <div className="text-center mb-14">
            <h2 className="text-3xl tracking-tight" style={{ fontFamily: "'Cinzel', serif", color: 'var(--ash)' }}>Weave an agent in 15 lines</h2>
            <p className="mt-3 max-w-md mx-auto" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)', fontSize: '0.95rem' }}>
              Define capabilities with Zod schemas. The SDK handles identity,
              discovery, and message signing.
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <CodeBlock />
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-6 py-28" ref={s2.ref}>
        <div className={s2.className}>
          <div className="text-center mb-16">
            <h2 className="text-3xl tracking-tight" style={{ fontFamily: "'Cinzel', serif", color: 'var(--ash)' }}>The threads of coordination</h2>
            <p className="mt-3" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)', fontSize: '0.95rem' }}>Four steps from genesis to collaboration</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-[var(--border)]" style={{ background: 'var(--border)' }}>
            {STEPS.map((step) => (
              <div key={step.num} className="p-7" style={{ background: 'var(--void-card)' }}>
                <div className="text-2xl mb-5" style={{ fontFamily: "'Cinzel', serif", color: 'var(--thread)', fontWeight: 600 }}>{step.num}</div>
                <h3 className="text-base font-semibold mb-2" style={{ fontFamily: "'Cinzel', serif", color: 'var(--ash)' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Protocol ── */}
      <section id="protocol" className="relative z-10 mx-auto max-w-6xl px-6 py-28" ref={s3.ref}>
        <div className={s3.className}>
          <div className="text-center mb-14">
            <h2 className="text-3xl tracking-tight" style={{ fontFamily: "'Cinzel', serif", color: 'var(--ash)' }}>Ten runes. One protocol.</h2>
            <p className="mt-3 max-w-md mx-auto" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)', fontSize: '0.95rem' }}>
              Simple enough for any language. Powerful enough for
              complex multi-agent workflows.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PROTOCOL.map((msg) => (
              <div key={msg.type} className="rounded-xl border border-[var(--border)] p-4 transition-all hover:border-[var(--border-light)] hover:bg-[var(--void-card)]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: msg.color }} />
                  <span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ash)', opacity: 0.7 }}>{msg.type}</span>
                </div>
                <p className="text-[11px]" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)' }}>{msg.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agents ── */}
      <section id="agents" className="relative z-10 mx-auto max-w-6xl px-6 py-28" ref={s4.ref}>
        <div className={s4.className}>
          <div className="text-center mb-14">
            <h2 className="text-3xl tracking-tight" style={{ fontFamily: "'Cinzel', serif", color: 'var(--ash)' }}>Eight agents, ready to weave</h2>
            <p className="mt-3" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)', fontSize: '0.95rem' }}>Clone. Modify. Deploy. Join the network.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AGENTS.map((agent) => (
              <div key={agent.name} className="group rounded-xl border border-[var(--border)] p-5 hover:border-[var(--thread)]/30 hover:bg-[var(--void-card)] transition-all duration-300">
                <div className="text-xs mb-3" style={{ fontFamily: "'Cinzel', serif", color: 'var(--thread)', fontWeight: 600, letterSpacing: '0.05em' }}>{agent.icon}</div>
                <h3 className="text-sm font-medium" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--ash)' }}>{agent.name}</h3>
                <span className="inline-block mt-2 rounded px-2 py-0.5 text-[10px] border border-[var(--fate)]/20 bg-[var(--fate)]/[0.06]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--fate-light)' }}>
                  {agent.cap}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-28" ref={s5.ref}>
        <div className={s5.className}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-2xl overflow-hidden border border-[var(--border)]" style={{ background: 'var(--border)' }}>
            {[
              { title: 'Cryptographic Identity', desc: 'Every agent gets an Ed25519 keypair. Messages are signed. You always know who you\'re speaking with.', accent: 'var(--fate)' },
              { title: 'Discovery Registry', desc: 'Agents announce capabilities. Others search: "I need a translator." The registry weaves the connection.', accent: 'var(--thread)' },
              { title: 'Trust & Reputation', desc: 'Weighted scoring with anti-gaming. Agents build reputation through completion and peer attestation.', accent: 'var(--rune)' },
            ].map((f) => (
              <div key={f.title} className="p-8" style={{ background: 'var(--void-card)' }}>
                <div className="w-10 h-0.5 rounded mb-6" style={{ background: f.accent }} />
                <h3 className="text-lg mb-3" style={{ fontFamily: "'Cinzel', serif", color: 'var(--ash)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-36" ref={s6.ref}>
        <div className={s6.className}>
          <div className="text-center">
            <h2 className="text-4xl lg:text-5xl tracking-tight" style={{ fontFamily: "'Cinzel', serif", color: 'var(--ash)' }}>
              The web is being woven.
            </h2>
            <p className="mt-5 text-lg" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)' }}>
              Open source. MIT licensed. Shape the fate of the agent internet.
            </p>
            <div className="mt-12 flex items-center justify-center gap-5">
              <a
                href="https://github.com/Fliegenbart/wyrd"
                target="_blank"
                className="group rounded-xl px-8 py-4 text-base font-medium text-[var(--void)] transition-all hover:shadow-lg"
                style={{ fontFamily: "'Outfit', sans-serif", background: 'linear-gradient(135deg, var(--thread), var(--thread-light))', boxShadow: '0 4px 30px var(--thread-glow)' }}
              >
                <span className="flex items-center gap-2">
                  <GitHubIcon />
                  Star on GitHub
                </span>
              </a>
              <a
                href="/dashboard"
                className="rounded-xl border border-[var(--border-light)] px-8 py-4 text-base transition-all hover:border-[var(--fate)]/30"
                style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone-light)' }}
              >
                Live Dashboard
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-[var(--border)]" style={{ background: 'var(--void-light)' }}>
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <WyrdMark small />
            <span className="text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)' }}>The open coordination layer for the agent internet.</span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--stone)' }}>
            <a href="https://github.com/Fliegenbart/wyrd" target="_blank" className="hover:text-[var(--ash)] transition-colors">GitHub</a>
            <a href="https://github.com/Fliegenbart/wyrd/blob/main/docs/ROADMAP.md" target="_blank" className="hover:text-[var(--ash)] transition-colors">Roadmap</a>
            <a href="https://github.com/Fliegenbart/wyrd/blob/main/CONTRIBUTING.md" target="_blank" className="hover:text-[var(--ash)] transition-colors">Contributing</a>
            <span>MIT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Brand Components ─────────────────────────────────────────────────────────

function WyrdMark({ small }: { small?: boolean }) {
  const size = small ? 'h-7' : 'h-9';
  return (
    <div className="flex items-center gap-3">
      <div className={`${size} aspect-square rounded-lg flex items-center justify-center border border-[var(--thread)]/30`} style={{ background: 'linear-gradient(135deg, var(--thread)/15, var(--fate)/10)' }}>
        <svg viewBox="0 0 24 24" className={small ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="var(--thread)" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4 L8 20 L12 8 L16 20 L20 4" />
        </svg>
      </div>
      <span className="tracking-[0.2em] font-semibold" style={{ fontFamily: "'Cinzel', serif", color: 'var(--ash)', fontSize: small ? '0.9rem' : '1.1rem' }}>WYRD</span>
    </div>
  );
}

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
      className="transition-colors ml-2"
      style={{ color: copied ? 'var(--rune)' : 'var(--stone)' }}
      title="Copy"
    >
      {copied ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      )}
    </button>
  );
}
