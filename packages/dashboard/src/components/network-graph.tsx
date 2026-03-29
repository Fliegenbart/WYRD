'use client';

import { useEffect, useRef } from 'react';
import type { AgentInfo } from '@/lib/api';

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: 'registry' | 'agent';
}

function reputationColor(score: number) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

export function NetworkGraph({ agents }: { agents: AgentInfo[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    // Create nodes
    const nodes: Node[] = [
      {
        id: 'registry',
        label: 'Registry',
        x: w / 2,
        y: h / 2,
        vx: 0,
        vy: 0,
        radius: 24,
        color: '#6366f1',
        type: 'registry',
      },
    ];

    agents.forEach((agent, i) => {
      const angle = (i / agents.length) * Math.PI * 2;
      const dist = 100 + Math.random() * 60;
      nodes.push({
        id: agent.agentId,
        label: agent.name ?? agent.agentId.slice(0, 8),
        x: w / 2 + Math.cos(angle) * dist,
        y: h / 2 + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 14 + agent.capabilities.length * 4,
        color: reputationColor(agent.reputation.overall),
        type: 'agent',
      });
    });

    nodesRef.current = nodes;

    let pulsePhase = 0;

    function draw() {
      const w = canvas!.width / window.devicePixelRatio;
      const h = canvas!.height / window.devicePixelRatio;
      ctx!.clearRect(0, 0, w, h);

      pulsePhase += 0.02;

      const registry = nodes[0];

      // Draw connection lines
      for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        const dx = registry.x - node.x;
        const dy = registry.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        ctx!.beginPath();
        ctx!.moveTo(node.x, node.y);
        ctx!.lineTo(registry.x, registry.y);
        ctx!.strokeStyle = `rgba(99, 102, 241, ${0.15 + 0.05 * Math.sin(pulsePhase + i)})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        // Data packet animation
        const t = ((Date.now() / 2000 + i * 0.3) % 1);
        const px = node.x + dx * t;
        const py = node.y + dy * t;
        ctx!.beginPath();
        ctx!.arc(px, py, 2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(99, 102, 241, ${0.6 + 0.3 * Math.sin(pulsePhase * 3 + i)})`;
        ctx!.fill();
      }

      // Simple force simulation
      for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];

        // Attract toward center
        const dx = w / 2 - node.x;
        const dy = h / 2 - node.y;
        node.vx += dx * 0.0001;
        node.vy += dy * 0.0001;

        // Repel from other nodes
        for (let j = 1; j < nodes.length; j++) {
          if (i === j) continue;
          const ox = node.x - nodes[j].x;
          const oy = node.y - nodes[j].y;
          const d = Math.max(1, Math.sqrt(ox * ox + oy * oy));
          if (d < 80) {
            node.vx += (ox / d) * 0.3;
            node.vy += (oy / d) * 0.3;
          }
        }

        // Damping
        node.vx *= 0.98;
        node.vy *= 0.98;

        node.x += node.vx;
        node.y += node.vy;

        // Bounds
        node.x = Math.max(node.radius, Math.min(w - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(h - node.radius, node.y));
      }

      // Draw nodes
      for (const node of nodes) {
        // Glow
        const glowSize = node.type === 'registry' ? 30 : 15;
        const gradient = ctx!.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, node.radius + glowSize,
        );
        gradient.addColorStop(0, node.color + '40');
        gradient.addColorStop(1, node.color + '00');
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.radius + glowSize, 0, Math.PI * 2);
        ctx!.fillStyle = gradient;
        ctx!.fill();

        // Circle
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx!.fillStyle = node.color + '30';
        ctx!.strokeStyle = node.color;
        ctx!.lineWidth = 2;
        ctx!.fill();
        ctx!.stroke();

        // Label
        ctx!.font = node.type === 'registry' ? 'bold 11px Inter, system-ui' : '10px Inter, system-ui';
        ctx!.fillStyle = '#e4e4e7';
        ctx!.textAlign = 'center';
        ctx!.fillText(node.label, node.x, node.y + node.radius + 16);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [agents]);

  return (
    <div className="relative h-[400px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 text-xs text-[var(--text-dim)] bg-[var(--bg)]/70 px-2 py-1 rounded">
        Network Graph — {agents.length} agents connected
      </div>
    </div>
  );
}
