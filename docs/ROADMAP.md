# WYRD Roadmap

> Wette: Wer die beste Discovery + Trust-Schicht für das Agent-Internet baut, kontrolliert den Markt. Wie Cloudflare für das menschliche Internet, aber für Bots.

## Strategie

```
Phase 1 (jetzt):   Virale Open-Source-Demo → GitHub Stars → Community
Phase 2 (bald):    A2A-Kompatibilität → Standard-Adoption → Player werden
Phase 3 (später):  Enterprise Trust/Policy Layer → Revenue → Acquisition
```

---

## Tier 1 — Muss sofort passieren (Woche 1-4)

### 1. Landing Page / Website
- [ ] Hero-Section mit animiertem Network-Graph
- [ ] "30 seconds to your first agent" interaktive Demo-Section
- [ ] Protocol-Visualisierung (10 Message Types als Animation)
- [ ] Live-Counter: "X agents online right now" (wenn Public Registry steht)
- [ ] Responsive, dark theme, viral-tauglich
- [ ] Deploy auf Vercel oder Cloudflare Pages

### 2. Real API Agents (nicht mehr nur simulierte Daten)
- [ ] Weather Agent → OpenWeatherMap API (free tier)
- [ ] Translator Agent → DeepL API oder LibreTranslate
- [ ] News Agent → NewsAPI.org
- [ ] Mindestens 2-3 Agents mit echten API-Calls

### 3. CLI polish (`npx create-wyrd`)
- [ ] Templates die sofort lauffähig sind (install → dev → works)
- [ ] Template-Auswahl: minimal, multi-capability, orchestrator
- [ ] Automatischer identity.pem + .env setup
- [ ] README im generierten Projekt

### 4. Brand & Design Assets
- [ ] Logo (mehr als nur "AN" im Quadrat)
- [ ] Hero-Banner für GitHub README
- [ ] Animiertes GIF der Demo für README
- [ ] Architecture-Diagram als SVG
- [ ] Farbpalette & Typography Guidelines

---

## Tier 2 — Macht es ernst (Monat 2-3)

### 5. Hosted Public Registry
- [ ] `registry.wyrd.dev` — öffentlicher Discovery-Service
- [ ] Jeder kann seinen Agent registrieren
- [ ] Rate Limiting, Abuse Prevention
- [ ] Dashboard zeigt Live-Netzwerk-Stats
- [ ] Das ist der Netzwerk-Effekt — solange es nur lokal läuft, ist es eine Demo

### 6. A2A Agent Card Kompatibilität
- [ ] Agent-Announcements als A2A Agent Cards exportierbar
- [ ] `/.well-known/agent-card.json` Endpoint pro Agent
- [ ] A2A-Discovery-Format lesen und schreiben
- [ ] Kompatibel statt konkurrierend positionieren

### 7. Auth & Access Control
- [ ] API Keys für Registry-Zugang
- [ ] Agent Permissions (wer darf was aufrufen)
- [ ] Spend Limits (Budget-Constraints pro Task)
- [ ] Approval-Workflows (Human-in-the-loop)

### 8. Dashboard v2
- [ ] Auto-Refresh / Live-Updates via SSE oder WebSocket
- [ ] Task-Feed: Live-Stream aller Tasks im Netzwerk
- [ ] Agent-Detail-Seite mit Reputation-History-Chart
- [ ] Playground: echte Task-Execution (nicht nur Vorschau)
- [ ] Dark/Light Mode Toggle
- [ ] Mobile Responsive
- [ ] Bessere Network-Graph-Animationen (Particle-Effekte, Task-Flow-Pulse)

---

## Tier 3 — Das Business (Monat 3-6)

### 9. Trust Cards & Policy Negotiation
- [ ] Maschinenlesbare Guardrails pro Agent
- [ ] Attestations: "operator verified", "payment capable", "human approval required"
- [ ] Policy-Matching: zwei Agents handeln erlaubte Actions aus
- [ ] Jurisdiction & Compliance Tags
- [ ] Das ist das Produkt das acquireable macht

### 10. Observability & Analytics
- [ ] Logs, Traces, Error-Rates pro Agent
- [ ] Task-Duration-Histogramme
- [ ] "Datadog für Agents"
- [ ] Alerting bei Agent-Ausfällen
- [ ] Cost-Tracking (wie viel hat eine Agent-Kette gekostet)

### 11. Payment / Micropayment Layer
- [ ] Agents können Preise für Tasks festlegen
- [ ] Micropayment-Settlement zwischen Agents
- [ ] Budget-Kontrolle für Orchestrator-Tasks
- [ ] Abrechnungs-Dashboard

### 12. Multi-Registry Federation
- [ ] Mehrere Registries die sich untereinander synchronisieren
- [ ] Private Enterprise Registries + Public Registry
- [ ] Cross-Registry Discovery
- [ ] Wie DNS Hierarchie, aber für Agents

### 13. Agent Marketplace
- [ ] Agents deployen und monetarisieren
- [ ] Bewertungen, Reviews, Download-Zahlen
- [ ] "App Store für Agents"
- [ ] Templates & Starter-Kits

---

## Was wir NICHT bauen

- Kein eigenes LLM / Foundation Model
- Kein Agent-Framework (das ist LangChain/CrewAI territory)
- Kein konkurrierendes Basisprotokoll zu A2A (wir bauen darauf auf)
- Keine Social Media Bots

---

## Done ✅

- [x] Protocol: 10 Message Types mit Zod Schemas
- [x] Identity: Ed25519 Crypto-Identität
- [x] Transport: WebSocket mit Auto-Reconnect
- [x] SDK: Agent + AgentClient + defineCapability
- [x] Registry: Hono + SQLite Discovery Service
- [x] Reputation: Trust Scoring + Anti-Gaming
- [x] Dashboard: Next.js mit Network Graph + Playground
- [x] CLI: create-wyrd Scaffolding
- [x] 8 Example Agents
- [x] Multi-Agent Demo (8 Agents + Orchestrator)
- [x] GitHub Actions CI
- [x] Docker Compose
- [x] CONTRIBUTING.md
- [x] GitHub Repo: github.com/Fliegenbart/WYRD
