'use client';

import { useEffect, useRef, useState } from 'react';

// ── WYRD Network Canvas ──────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  radius: number; color: string; label: string; type: 'registry' | 'agent';
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
      ctx.setTransform(2, 0, 0, 2, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    const agentNames = ['Weather', 'Translator', 'Flights', 'CodeReview', 'Research', 'Prices', 'News', 'Orchestrator'];
    const agentColors = ['#d4a843', '#7b7bea', '#00d4aa', '#e5484d', '#5b5bd6', '#e8c56a', '#06b6d4', '#d4a843'];

    const particles: Particle[] = [
      { x: 0.5, y: 0.48, vx: 0, vy: 0, radius: 20, color: '#5b5bd6', label: 'WYRD', type: 'registry' },
    ];

    agentNames.forEach((name, i) => {
      const angle = (i / agentNames.length) * Math.PI * 2 - Math.PI / 2;
      const dist = 0.2 + Math.random() * 0.1;
      particles.push({
        x: 0.5 + Math.cos(angle) * dist,
        y: 0.48 + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.00012,
        vy: (Math.random() - 0.5) * 0.00012,
        radius: 7 + Math.random() * 5,
        color: agentColors[i],
        label: name,
        type: 'agent',
      });
    });

    // Threads (fate lines between agents, not just to registry)
    const threads: [number, number][] = [];
    for (let i = 1; i < particles.length; i++) threads.push([0, i]); // all to registry
    // Some agent-to-agent threads
    threads.push([1, 3], [2, 5], [4, 7], [6, 8], [3, 6]);

    const stars = Array.from({ length: 100 }, () => ({
      x: Math.random(), y: Math.random(),
      size: Math.random() * 1.2 + 0.2,
      alpha: Math.random() * 0.3 + 0.05,
      speed: Math.random() * 0.015 + 0.003,
    }));

    // Data packets along threads
    const packets: { threadIdx: number; t: number; speed: number; forward: boolean }[] = [];
    const spawnPacket = () => {
      const idx = Math.floor(Math.random() * threads.length);
      packets.push({ threadIdx: idx, t: 0, speed: 0.006 + Math.random() * 0.01, forward: Math.random() > 0.3 });
    };

    let frame = 0;

    const draw = () => {
      const W = w();
      const H = h();
      ctx.clearRect(0, 0, W, H);
      frame++;

      // Stars
      for (const star of stars) {
        const a = star.alpha + Math.sin(frame * star.speed) * 0.12;
        ctx.beginPath();
        ctx.arc(star.x * W, star.y * H, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 190, 220, ${a})`;
        ctx.fill();
      }

      if (frame % 25 === 0) spawnPacket();

      // Update particles
      for (let i = 1; i < particles.length; i++) {
        const p = particles[i];
        const dx = 0.5 - p.x;
        const dy = 0.48 - p.y;
        p.vx += dx * 0.000006;
        p.vy += dy * 0.000006;
        const mx = mouseRef.current.x / W - p.x;
        const my = mouseRef.current.y / H - p.y;
        const md = Math.sqrt(mx * mx + my * my);
        if (md < 0.15 && md > 0.01) {
          p.vx -= (mx / md) * 0.00002;
          p.vy -= (my / md) * 0.00002;
        }
        p.vx *= 0.996;
        p.vy *= 0.996;
        p.x += p.vx;
        p.y += p.vy;
        p.x = Math.max(0.08, Math.min(0.92, p.x));
        p.y = Math.max(0.08, Math.min(0.92, p.y));
      }

      // Draw threads (fate lines)
      for (const [ai, bi] of threads) {
        const a = particles[ai];
        const b = particles[bi];
        const ax = a.x * W, ay = a.y * H;
        const bx = b.x * W, by = b.y * H;

        // Thread line — golden/indigo gradient
        const grad = ctx.createLinearGradient(ax, ay, bx, by);
        const alpha = 0.08 + Math.sin(frame * 0.012 + ai + bi) * 0.04;
        grad.addColorStop(0, `rgba(212, 168, 67, ${alpha})`);
        grad.addColorStop(0.5, `rgba(91, 91, 214, ${alpha * 1.2})`);
        grad.addColorStop(1, `rgba(212, 168, 67, ${alpha})`);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Data packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const pk = packets[i];
        pk.t += pk.speed;
        if (pk.t >= 1) { packets.splice(i, 1); continue; }
        const [ai, bi] = threads[pk.threadIdx];
        const from = pk.forward ? particles[ai] : particles[bi];
        const to = pk.forward ? particles[bi] : particles[ai];
        const px = (from.x + (to.x - from.x) * pk.t) * W;
        const py = (from.y + (to.y - from.y) * pk.t) * H;

        // Golden glow packet
        const grd = ctx.createRadialGradient(px, py, 0, px, py, 10);
        grd.addColorStop(0, 'rgba(212, 168, 67, 0.7)');
        grd.addColorStop(0.5, 'rgba(212, 168, 67, 0.15)');
        grd.addColorStop(1, 'rgba(212, 168, 67, 0)');
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#d4a843';
        ctx.fill();
      }

      // Draw nodes
      for (const p of particles) {
        const px = p.x * W, py = p.y * H;

        // Outer glow
        const glowR = p.type === 'registry' ? 50 : 22;
        const grd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        grd.addColorStop(0, p.color + '20');
        grd.addColorStop(1, p.color + '00');
        ctx.beginPath();
        ctx.arc(px, py, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color + '15';
        ctx.strokeStyle = p.color + (p.type === 'registry' ? 'bb' : '77');
        ctx.lineWidth = p.type === 'registry' ? 2 : 1.2;
        ctx.fill();
        ctx.stroke();

        // Inner core
        ctx.beginPath();
        ctx.arc(px, py, p.type === 'registry' ? 6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Label
        if (p.type === 'registry') {
          ctx.font = "600 12px 'Cinzel', serif";
          ctx.fillStyle = '#d4a843';
        } else {
          ctx.font = "400 9px 'Outfit', system-ui";
          ctx.fillStyle = 'rgba(237,237,239,0.5)';
        }
        ctx.textAlign = 'center';
        ctx.fillText(p.label, px, py + p.radius + 15);
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
