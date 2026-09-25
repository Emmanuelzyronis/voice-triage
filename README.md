# ArkOps

**AI-powered conversational voice agent for field service dispatch**

> 🔴 **LIVE — Actively building** · AssemblyAI Voice Agent Hackathon · Submission deadline **September 30, 2026**

---

## What it does

ArkOps replaces the traditional "press 1 for service" IVR with a genuine AI phone agent that *has a conversation* with the caller, understands their request, and routes it to a human dispatcher for one-click approval before anything executes.

**The flow:**

1. Caller speaks — AssemblyAI v3 streaming STT transcribes in real-time with end-of-turn detection
2. ArkOps AI asks natural follow-up questions until it has all required info (equipment + location)
3. Once the conversation is complete, an 8-stage LangGraph pipeline runs automatically:

```
Parse → Classify → Research → Draft → Evaluate → Approve → Execute
```

4. The dispatcher sees the full conversation transcript, a drafted action plan, and an evaluation score — then approves or rejects in one click
5. On approval, ArkOps executes the action (schedules a technician, creates a work order, etc.)

**Demo tenant:** Apex Field Services (HVAC dispatch)

---

## Tech stack

| Layer | Technology |
|---|---|
| Voice STT | AssemblyAI v3 Streaming API (`universal-3-5-pro`, `min_latency` mode) |
| Voice TTS | Azure OpenAI TTS (`nova` voice) |
| LLM | Azure OpenAI `gpt-5-mini` (reasoning model, `reasoning_effort=low`) |
| Orchestration | LangGraph (8-node pipeline graph) |
| Knowledge base | ChromaDB (tenant-specific RAG) |
| Backend | FastAPI + uvicorn |
| Frontend | Next.js 16 (App Router, Turbopack) |
| Audio capture | Web AudioWorklet (16kHz, 200ms chunk buffering) |

---

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 18+
- An AssemblyAI account (get API key at [assemblyai.com](https://www.assemblyai.com))
- An Azure OpenAI resource with `gpt-5-mini` and `tts-1` deployments

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

Create `backend/.env`:

```env
ASSEMBLYAI_API_KEY=your_assemblyai_key

AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_TTS_DEPLOYMENT=tts-1

CHROMA_PERSIST_DIRECTORY=./chroma_db
```

Run the backend:

```bash
uvicorn backend.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3001
```

Open the app, click **Start Call**, and speak. ArkOps will greet the caller and conduct the intake conversation.

---

## Project structure

```
voice-triage/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket endpoints
│   ├── config.py            # Settings (pydantic-settings)
│   ├── pipeline/
│   │   ├── conversation.py  # ConversationSession + ConversationAgent (multi-turn intake)
│   │   ├── graph.py         # LangGraph pipeline definition
│   │   ├── parse.py         # Parse + classify (single LLM call)
│   │   ├── research.py      # ChromaDB RAG lookup
│   │   ├── draft.py         # Action plan drafting
│   │   ├── evaluate.py      # Quality evaluation
│   │   ├── approve.py       # Human approval gate
│   │   └── execute.py       # Execution stage
│   ├── tenants/             # Tenant configs (YAML)
│   ├── models/              # Pydantic types
│   └── audit/               # Audit log writer
├── frontend/
│   ├── app/page.tsx         # Main page + phase rendering
│   ├── hooks/usePipeline.ts # WebSocket state + TTS
│   ├── components/
│   │   ├── ConversationView.tsx  # Chat bubble UI
│   │   ├── MicCapture.tsx        # Mic button + level meter
│   │   ├── PipelineStatus.tsx    # Stage progress
│   │   ├── ApprovalGate.tsx      # Dispatcher approval UI
│   │   └── ExecutedPanel.tsx     # Result display
│   └── public/audio-processor.js # AudioWorklet (200ms chunk buffering)
└── docs/                    # Architecture docs
```

---

## How the conversation works

The `ConversationSession` wraps AssemblyAI v3 streaming with end-of-turn detection (`end_of_turn_confidence_threshold=0.7`). When a turn completes, `ConversationAgent` (an LLM-driven intake agent) responds with either a follow-up question or a completion signal. The conversation continues until the agent has:

- What the issue is (equipment type + problem)
- Where it is (address or location)

After up to 6 user turns, it signals completion and hands the full transcript to the pipeline.

---

## Join the team — We're hiring collaborators

We're actively building ArkOps for the **AssemblyAI Voice Agent Hackathon** (submission: September 30, 2026), and the project will continue as a product SaaS after the hackathon.

**Emmanuel Ibiezugbe** ([@Emmanuelzyronis](https://github.com/Emmanuelzyronis)) is the lead — currently in the build phase, shipping daily.

If you want to contribute or join the team:

- Open an [issue](https://github.com/Emmanuelzyronis/voice-triage/issues) with what you bring
- Or reach out directly via GitHub

**Useful skills:**
- Python / FastAPI / LangGraph
- Next.js / React / TypeScript
- Voice AI / streaming audio / WebRTC
- Azure OpenAI / AssemblyAI
- Product thinking — we're building toward a multi-tenant SaaS

All skill levels welcome. The codebase is clean and well-structured — good place to learn voice AI end-to-end.

---

## Hackathon context

Built for the **[AssemblyAI Voice Agent Hackathon](https://www.assemblyai.com)**.

Key technical decisions made during the build:
- AssemblyAI v3 streaming API (not v2) — end-of-turn detection is the core primitive
- Reasoning model (`gpt-5-mini`) with `reasoning_effort=low` — 16s pipeline vs 10+ minutes naive
- Parse + classify merged into one LLM call — saves a full round-trip
- AudioWorklet buffering to 200ms — v3 requires 50–1000ms chunks; browser default is 8ms

---

## License

MIT © 2026 Emmanuel Ibiezugbe
