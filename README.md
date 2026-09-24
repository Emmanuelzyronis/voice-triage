# VoiceTriage

> **AssemblyAI Voice Agent Hackathon 2026** · lablab.ai · MIT License

**Voice-supervised agentic pipeline with human approval — not another voice chatbot.**

[![AssemblyAI Hackathon 2026](https://img.shields.io/badge/AssemblyAI-Hackathon%202026-00bcd4?style=flat-square)](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon)
[![lablab.ai](https://img.shields.io/badge/lablab.ai-platform-7c3aed?style=flat-square)](https://lablab.ai)
[![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)
[![Deadline](https://img.shields.io/badge/deadline-Sep%2030%202026-red?style=flat-square)]()

---

## ⚡ Sprint Plan (Sep 24–30)

| Day | Date | Goal |
|-----|------|------|
| 1 | Sep 24 | Scaffold backend + AssemblyAI real-time STT streaming to console |
| 2 | Sep 25 | Parse + Classify stages; LangGraph pipeline skeleton wired end-to-end |
| 3 | Sep 26 | Research stage (ChromaDB retrieval) + Draft stage (structured output slots) |
| 4 | Sep 27 | Evaluate (adversarial self-review) + Approve gate enforced in code |
| 5 | Sep 28 | Next.js frontend — mic capture, WebSocket live transcript, approval UI |
| 6 | Sep 29 | Integration testing, demo polish, record video |
| 7 | **Sep 30** | **Submit by 11:00 AM EDT** — video, slides, repo, lablab.ai form |

---

## What VoiceTriage Is

Most voice agent hackathon submissions are: microphone → STT → LLM → speaker. VoiceTriage is different.

VoiceTriage treats voice as the **input to a proper agentic pipeline** — one with structured output contracts, an adversarial self-review step, and a human approval gate that cannot be bypassed in code. Nothing is actioned without a human decision. The pipeline is correct by construction, not by hoping the model behaves.

**The core insight:** the problem with voice automation isn't the STT quality. It's that downstream processing is either a chatbot (no memory, no structure, no accountability) or fully autonomous (no human in the loop, errors go undetected). VoiceTriage is neither.

---

## 8-Stage Pipeline

```
┌─────────────┐
│   LISTEN    │  AssemblyAI real-time streaming STT
│             │  Microphone → transcript chunks → final transcript
└──────┬──────┘
       │
┌──────▼──────┐
│    PARSE    │  Extract intent, entities, urgency from transcript
│             │  Output: structured ParseResult (not free text)
└──────┬──────┘
       │
┌──────▼──────┐
│  CLASSIFY   │  Triage into: ACTION_REQUIRED / INFO_REQUEST /
│             │  ESCALATE / DEFER / AMBIGUOUS
└──────┬──────┘
       │
┌──────▼──────┐
│  RESEARCH   │  ChromaDB semantic search on knowledge base
│             │  Returns: ranked context chunks with source refs
└──────┬──────┘
       │
┌──────▼──────┐
│    DRAFT    │  Structured output slots — model fills defined fields:
│             │  summary / action_items / caveats / confidence
│             │  (NOT free prose — makes Evaluate tractable)
└──────┬──────┘
       │
┌──────▼──────┐
│  EVALUATE   │  Adversarial self-review before human sees anything
│             │  Checks: intent addressed? claims grounded? tone right?
│             │  Verdict: PASS / FAIL per criterion (structured)
└──────┬──────┘
       │
┌──────▼──────┐
│   APPROVE   │  Human sees: transcript + evaluation verdict + draft
│             │  Options: APPROVE / EDIT+APPROVE / REJECT+REASON
│             │  Gate enforced structurally — no code path bypasses it
└──────┬──────┘
       │
┌──────▼──────┐
│   EXECUTE   │  Carry out the approved action
│             │  Full audit trail written before execution
└─────────────┘
```

---

## Why Each Stage Matters

**LISTEN (AssemblyAI):** Real-time streaming — users see their words appear as they speak. Final transcript is punctuated and formatted. No polling, no wait time.

**PARSE:** Voice input is messy. "Uh, I need to, like, schedule a meeting with the sales team for next week, maybe Thursday?" needs to become `{intent: SCHEDULE_MEETING, participants: [sales_team], date_hint: "next Thursday", urgency: LOW}`. This structure is what makes every downstream stage fast and auditable.

**CLASSIFY:** Routes to the right pipeline variant. An INFO_REQUEST doesn't need an approval gate the same way an ACTION_REQUIRED does. Classification is the branching decision.

**RESEARCH:** Pulls relevant knowledge before drafting. The draft model is grounded in retrieved context — it cannot hallucinate facts that don't appear in the knowledge base, and the Evaluate stage can check this.

**DRAFT (structured output):** The model fills slots, not blank paper. `summary`, `action_items[]`, `caveats[]`, `confidence` (0–1), `sources[]`. Structured output is not a style choice — it's what makes the Evaluate step possible. You cannot reliably check free prose for factual grounding. You can check whether each action item has a source citation.

**EVALUATE (adversarial):** The prompt is adversarial — it does not ask "is this good?" It asks "find three reasons this draft might be wrong, then assess whether any of them actually apply." Structured verdict per criterion. The human reviewer sees the specific failure, not a vague warning.

**APPROVE (gate):** The approval UI shows: the original transcript, the evaluation verdict (per-criterion breakdown), and the draft side by side. The human can approve, edit before approving, or reject with a reason. A rejection is logged. There is no button that sends or actions anything before reaching APPROVED state. This is the engineering position, not a UX preference.

**EXECUTE:** Approved actions are executed with a full audit trail — transcript, parse result, classification, retrieved context, draft, evaluation verdict, approval decision, execution timestamp — written atomically before execution.

---

## How AssemblyAI Is Used

AssemblyAI is the mandatory core of the LISTEN stage:

- **Real-time streaming STT** via `assemblyai.RealtimeTranscriber`
- Partial transcripts stream to the frontend over WebSocket as the user speaks
- Final punctuated transcript triggers the pipeline
- Speaker diarization enabled where applicable
- AssemblyAI handles: noise, accents, filler words, punctuation restoration

```python
import assemblyai as aai

aai.settings.api_key = ASSEMBLYAI_API_KEY

transcriber = aai.RealtimeTranscriber(
    sample_rate=16_000,
    on_data=on_transcript_data,   # streams partials to UI
    on_final=on_transcript_final, # triggers pipeline
    on_error=on_error,
)
```

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| STT | AssemblyAI SDK | Required. Real-time streaming, punctuation, low latency |
| Pipeline | LangGraph | Explicit stage graph, deterministic state transitions, easy to audit |
| Context retrieval | ChromaDB | Local-first vector store, no external service dependency |
| LLM | Azure OpenAI | Structured output support, deterministic temperature=0 for evaluation |
| Backend | FastAPI + Uvicorn | Async WebSocket support, typed routes |
| Frontend | Next.js + React + Tailwind | Approval UI, real-time transcript display |
| WebSocket | FastAPI WebSocket | Live transcript feed from AssemblyAI to browser |

---

## Project Structure

```
voice-triage/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket endpoint
│   ├── pipeline/
│   │   ├── graph.py         # LangGraph pipeline definition
│   │   ├── stages/
│   │   │   ├── parse.py     # Intent + entity extraction
│   │   │   ├── classify.py  # Triage classification
│   │   │   ├── research.py  # ChromaDB retrieval
│   │   │   ├── draft.py     # Structured output generation
│   │   │   ├── evaluate.py  # Adversarial self-review
│   │   │   └── execute.py   # Approved action execution
│   │   └── models.py        # Pydantic models for each stage I/O
│   ├── stt/
│   │   └── assemblyai.py    # AssemblyAI real-time transcriber
│   ├── knowledge/
│   │   ├── store.py         # ChromaDB client + retrieval
│   │   └── seed.py          # Seed demo knowledge base
│   └── audit/
│       └── log.py           # Immutable audit trail writer
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx         # Main pipeline UI
│   │   └── components/
│   │       ├── MicCapture.tsx     # Mic button + level meter
│   │       ├── LiveTranscript.tsx # Real-time transcript display
│   │       ├── PipelineStatus.tsx # Stage-by-stage progress
│   │       ├── DraftReview.tsx    # Draft + evaluation verdict
│   │       └── ApprovalGate.tsx   # Approve / Edit / Reject
│   └── package.json
├── docs/
│   ├── PIPELINE.md          # Full pipeline specification
│   ├── SPRINT_PLAN.md       # Day-by-day build plan
│   └── DEMO_SCRIPT.md       # Video demo script
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

---

## Setup

```bash
# 1. Clone
git clone https://github.com/Emmanuelzyronis/voice-triage.git
cd voice-triage

# 2. Copy env
cp .env.example .env
# Fill in: ASSEMBLYAI_API_KEY, AZURE_OPENAI_*, CHROMA_PERSIST_DIRECTORY

# 3. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 4. Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Environment Variables

```
ASSEMBLYAI_API_KEY=         # Required — get at app.assemblyai.com
AZURE_OPENAI_ENDPOINT=      # e.g. https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=    # e.g. gpt-4o
CHROMA_PERSIST_DIRECTORY=./chroma_db
```

---

## Submission Checklist

- [ ] AssemblyAI real-time STT working end-to-end
- [ ] All 8 pipeline stages functional
- [ ] Approval gate: no action possible without APPROVED state
- [ ] Frontend: mic capture → live transcript → pipeline status → approval UI
- [ ] Audit trail written for every completed pipeline run
- [ ] Demo video recorded (~3 min, see `docs/DEMO_SCRIPT.md`)
- [ ] Slide deck (5–7 slides: problem / pipeline / demo / why it wins)
- [ ] MIT LICENSE present in repo
- [ ] `.env.example` present (no secrets committed)
- [ ] lablab.ai submission form filled + repo linked
- [ ] **Submit by September 30, 2026 @ 11:00 AM EDT**

---

## License

MIT License — see [LICENSE](./LICENSE)
