# ArkOps

> **AI that turns operational conversations into approved work.**

[![AssemblyAI Hackathon 2026](https://img.shields.io/badge/AssemblyAI-Hackathon%202026-00bcd4?style=flat-square)](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon)
[![lablab.ai](https://img.shields.io/badge/lablab.ai-Zyronis%20Team-7c3aed?style=flat-square)](https://lablab.ai)
[![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)
[![Deadline](https://img.shields.io/badge/deadline-Sep%2030%202026-red?style=flat-square)]()

---

## What ArkOps Is

ArkOps is a **multi-tenant AI operations layer** that converts inbound conversations — starting with voice and phone — into structured, human-approved actions inside each tenant's own systems.

Every tenant configures their own:

| Tenant owns | Examples |
|---|---|
| Phone numbers / channels | Inbound call lines, voicemail boxes |
| Users and roles | Dispatcher, manager, admin |
| Customers / contacts | Their client records |
| AI instructions | Domain-specific system prompts |
| Workflows | What happens after each triage category |
| Approval rules | Who must approve what, and when |
| Integrations | Webhooks, email, calendar, CRM, ticketing |
| Records | Per-tenant knowledge base |
| Audit history | Every decision, immutable |

The shared engine does:

```
Call / voicemail
     ↓
 Transcription          ← AssemblyAI DictationTranscriber
     ↓
 Extract intent         ← Structured parse + evidence taxonomy (observed / inferred / unknown)
     ↓
 Classify               ← TriageCategory + LangGraph conditional routing
     ↓
 Retrieve context       ← ChromaDB, tenant-namespaced knowledge base
     ↓
 Draft action           ← Slot-based output grounded in retrieved context
     ↓
 Adversarial review     ← "Find 3 reasons this draft might be wrong" before human sees it
     ↓
 Human approval         ← Gate enforced in code (PipelineStateError if bypassed)
     ↓
 Execute                ← Structured result panel — full audit trail
```

The voice input is one channel. The valuable asset is the **workflow / approval / audit infrastructure underneath** — vertical-specific behaviour becomes configuration, not code.

---

## Why ArkOps, not "an AI receptionist"

A receptionist is a single-purpose product. ArkOps is infrastructure.

The same engine, different tenant config, serves:

| Vertical | The conversation | The action |
|---|---|---|
| **Field operations** | Customer calls about broken HVAC | Work order created → dispatcher approves → assigned |
| **Property management** | Tenant calls about maintenance | Ticket raised → landlord approves → contractor notified |
| **Insurance intake** | Claimant reports an incident | Claim record drafted → adjuster approves → assigned |
| **Legal intake** | Client describes a situation | Matter summary drafted → lawyer approves → filed |
| **Healthcare admin** | Patient calls about symptoms | Triage notes drafted → nurse approves → records updated |
| **Logistics** | Driver reports a delivery issue | Exception logged → ops approves → re-routed |

Vertical-specific behaviour (terminology, approval rules, integrations) lives in tenant config. The pipeline, evidence taxonomy, approval gate, and audit trail are shared across all of them.

---

## The Core Differentiator

Most voice AI products make one of two mistakes:

1. **Too passive** — transcribe, stop. Human still does all the work.
2. **Too autonomous** — LLM decides and acts. No accountability when it's wrong.

ArkOps takes the middle position: **the AI does the thinking, the human makes the decision, the system enforces the rule.** 

The approval gate is not a UI pattern — it is the graph topology. There is no code path from DRAFT to EXECUTE without an `APPROVED` state on the `PipelineState` object. This is the engineering position, not a feature flag.

The evidence taxonomy (`observed / inferred / unknown`) is the other pillar. The model surfaces what it knows, what it is guessing, and what it cannot determine — and these travel through every stage. The human approves knowing exactly what the AI is uncertain about. Unknown items are never collapsed into false confidence.

---

## Product Phases

### Phase 0 — Engine (Hackathon · Sep 30, 2026)

The core pipeline working for a single demo tenant in the field operations vertical.

**What's built:**
- 8-stage pipeline: Listen → Parse → Classify → Research → Draft → Evaluate → Approve → Execute
- AssemblyAI real-time STT (WebSocket + mic modes)
- ChromaDB knowledge base per tenant
- Adversarial self-review before human sees anything
- Human approval gate, structurally enforced
- Immutable audit log on every pipeline run
- FastAPI backend + Next.js approval UI

**Deliverable:** Working demo. AssemblyAI hackathon submission. Proof the engine is real.

---

### Phase 1 — Single-Tenant MVP

One paying customer. Full product, not a demo.

**What gets added:**
- Tenant configuration (YAML file → UI form)
  - AI instructions, approval rules, allowed categories, integrations
- Phone number provisioning (Twilio integration)
- Voicemail ingestion (async pipeline, not just real-time)
- Persistent audit database (PostgreSQL, not JSON files)
- Webhook integration (push approved actions to any endpoint)
- Email notification on approval required
- Simple approval UI hosted (not localhost)
- Auth (single user, Clerk or simple JWT)
- Basic usage dashboard (calls processed, approval rate, avg response time)

**Target customer:** A single field-service company (HVAC, plumbing, property management). They pay for the volume of minutes processed.

**Pricing (Phase 1):** Usage-based. $/minute of audio processed + flat monthly seat fee.

---

### Phase 2 — Multi-Tenant Core

Multiple paying customers. Proper isolation.

**What gets added:**
- Tenant isolation: shared DB + PostgreSQL Row-Level Security (RLS) on `tenant_id`
- Multi-user per tenant (roles: admin, dispatcher, viewer)
- Per-tenant knowledge bases (isolated ChromaDB collections or namespaced)
- Per-tenant API keys
- Tenant onboarding flow (self-serve signup → config → first call)
- Tenant admin dashboard: users, usage, audit history, integrations
- Schema-per-tenant upgrade path for larger accounts
- Metered billing (Stripe): minutes, calls, workflow runs
- Email + Slack notification channels

**Pricing tiers introduced:**

| Plan | Limits | Price |
|---|---|---|
| Starter | 1 location, 1 user, 100 calls/mo | $49/mo |
| Pro | 3 locations, 5 users, 500 calls/mo, integrations | $199/mo |
| Business | Unlimited locations, 20 users, 2,000 calls/mo, advanced approvals | $599/mo |
| Enterprise | Dedicated infra, SSO, SLA, custom integrations | Custom |

---

### Phase 3 — Workflow Builder

Tenants configure their own pipelines without code.

**What gets added:**
- Visual workflow builder: drag-and-drop approval chains
- Conditional rules: "if category=ESCALATE and urgency=HIGH, skip draft and page on-call"
- Workflow templates per vertical (field-ops, property, legal, insurance)
- Integration library: Calendar, Google Sheets, Salesforce, HubSpot, Linear, PagerDuty, Zapier webhook
- Retry and fallback rules
- SLA timers: "if no approval within 15 min, escalate to manager"
- Multi-channel input: email, SMS, web form (voice remains primary)

---

### Phase 4 — Enterprise

**What gets added:**
- Dedicated database per tenant (full isolation for regulated industries)
- SAML / SSO (Okta, Azure AD)
- Compliance export (SOC 2 audit log format, HIPAA-aligned for healthcare)
- White-label (customer's own domain and branding)
- Custom LLM deployment (bring your own Azure/Bedrock endpoint)
- SLA with uptime guarantee
- Professional services: onboarding, integration, training

---

## Architecture (Phase 2 target)

```
┌─────────────────────────────────────────────────────────┐
│                     ArkOps Platform                      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Tenant A │  │ Tenant B │  │ Tenant C │  ...         │
│  │ Field Ops│  │ Property │  │ Legal    │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ┌────▼──────────────▼──────────────▼────────────────┐  │
│  │              Shared Engine                        │  │
│  │  Listen → Parse → Classify → Research →           │  │
│  │  Draft → Evaluate → Approve → Execute             │  │
│  └────────────────────────────────────────────────┬──┘  │
│                                                   │     │
│  ┌──────────────────────────────────────────────┐ │     │
│  │  PostgreSQL + RLS    ChromaDB (namespaced)   │ │     │
│  │  tenant_id on all rows                       │ │     │
│  └──────────────────────────────────────────────┘ │     │
└──────────────────────────────────────────────────┘     │
                                                         │
       Tenant's own system (webhook / API / CRM)  ◄──────┘
```

**Isolation model (tiered):**

| Stage | Isolation | When |
|---|---|---|
| Early | Shared schema, RLS on `tenant_id` | Phase 2 default |
| Growth | Schema-per-tenant | Large Pro / Business accounts |
| Enterprise | Dedicated DB + infra | Regulated industries (healthcare, legal) |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| STT | AssemblyAI SDK | Real-time streaming, punctuation, low latency. Required for hackathon. |
| Pipeline | LangGraph | StateGraph with conditional routing per TriageCategory, deterministic state transitions, auditable |
| Vector store | ChromaDB | Local-first, no external service dependency, namespaced per tenant |
| LLM | Azure OpenAI (gpt-5-mini) | Structured output, deterministic at temp=0, enterprise SLA |
| Backend | FastAPI + Uvicorn | Async WebSocket, typed routes, fast |
| Frontend | Next.js + Tailwind | Approval UI, real-time transcript, SSR |
| Auth | Clerk | Multi-tenant auth, user roles, JWT |
| DB | PostgreSQL + RLS | Tenant isolation at DB layer |
| Phone | Twilio | Number provisioning, inbound call webhooks |
| Billing | Stripe | Metered usage + subscription |
| Infra | Railway | Deploy backend + DB, zero-config multi-env |

---

## Current State (Phase 0)

Backend scaffold complete:

```
backend/
├── main.py                   # FastAPI: WS /ws/audio, POST /approve/{id}
├── config.py                 # Pydantic Settings
├── models/types.py           # Full type hierarchy + PipelineState
├── pipeline/
│   ├── listen.py             # Stage 1 — AssemblyAI STT
│   ├── parse.py              # Stage 2 — Intent extraction
│   ├── classify.py           # Stage 3 — TriageCategory
│   ├── research.py           # Stage 4 — ChromaDB retrieval
│   ├── draft.py              # Stage 5 — DraftSlots
│   ├── evaluate.py           # Stage 6 — Adversarial self-review
│   ├── approve.py            # Stage 7 — Human gate (async, awaits decision)
│   └── execute.py            # Stage 8 — Dispatch on category
└── scripts/test_mic.py       # Day 1 smoke test
```

**Still needed (Phase 0 completion):**
- [ ] Tenant config model + demo seed (`config/tenant_demo.yaml`)
- [ ] `PipelineState` tenant-aware (`tenant_id` field)
- [ ] Next.js frontend: mic capture, live transcript, approval UI
- [ ] Integration test: full pipeline end-to-end
- [ ] Demo video + submission

---

## Quick Start (Phase 0 / Hackathon)

```bash
git clone https://github.com/Emmanuelzyronis/voice-triage.git arkops
cd arkops

# Copy env — fill in your keys
cp backend/.env.example backend/.env

# Install backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e "."              # add [mic] only if PortAudio is installed (brew install portaudio / apt install portaudio19-dev)

# Day 1 smoke test — speak, see transcript
python -m backend.scripts.test_mic

# Run server
uvicorn backend.main:app --reload --port 8001

# Frontend (separate terminal)
cd ../frontend
npm install && npm run dev
# → http://localhost:3000
```

---

## Environment Variables

```
ASSEMBLYAI_API_KEY=             # app.assemblyai.com
AZURE_OPENAI_ENDPOINT=          # https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
CHROMA_PERSIST_DIRECTORY=./chroma_db
MAX_RETRIES=3
APPROVAL_TIMEOUT_SECONDS=300
```

---

## Submission Checklist (Sep 30)

- [ ] AssemblyAI real-time STT working end-to-end
- [ ] All 8 pipeline stages functional
- [ ] Tenant config wired (demo tenant: field operations)
- [ ] Approval gate: no action possible without APPROVED state
- [ ] Frontend: mic → live transcript → pipeline stages → approval UI
- [ ] Audit trail on every completed run
- [ ] Demo video recorded (~3 min, see `docs/DEMO_SCRIPT.md`)
- [ ] `docs/PITCH.md` — platform vision, phases, expansion path
- [ ] MIT LICENSE + `.env.example` (no secrets) in repo
- [ ] lablab.ai submission form filled + repo linked
- [ ] **Submit by September 30, 2026 @ 11:00 AM EDT**

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Built by Emmanuel Ibiezugbe — [emmanuelibiezugbe.com](https://emmanuelibiezugbe.com)*
