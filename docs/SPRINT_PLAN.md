# VoiceTriage Sprint Plan

**Deadline: September 30, 2026 @ 11:00 AM EDT**
**Today: September 24, 2026**
**Days remaining: 6**

---

## Day 1 — September 24 · Scaffold + STT

**Goal:** AssemblyAI real-time transcription working, transcript appears in terminal.

### Tasks
- [ ] `backend/` Python project: `pyproject.toml`, `requirements.txt`, `.venv`
- [ ] `backend/stt/assemblyai.py` — `RealtimeTranscriber` setup, `on_data` + `on_final` callbacks
- [ ] `backend/main.py` — FastAPI app skeleton + `/ws` WebSocket endpoint
- [ ] `backend/pipeline/models.py` — Pydantic models for all stage I/O
- [ ] Manual test: speak into mic → transcript prints to terminal
- [ ] Confirm: `TranscriptResult` with `text`, `confidence`, `session_id` returned

**Done when:** "Hello, schedule a meeting with the sales team for Thursday" spoken → clean transcript in terminal.

---

## Day 2 — September 25 · Parse + Classify + LangGraph skeleton

**Goal:** Full LangGraph graph defined end-to-end. Parse and Classify stages working.

### Tasks
- [ ] `backend/pipeline/graph.py` — LangGraph `StateGraph` with all 8 nodes defined
- [ ] `backend/pipeline/stages/parse.py` — Intent + entity extraction via Azure OpenAI structured output
- [ ] `backend/pipeline/stages/classify.py` — Triage classification (5 categories)
- [ ] Wire: `TranscriptResult` → `ParseResult` → `ClassifyResult`
- [ ] Unit test: 5 transcript examples → correct classification each

**Done when:** "Schedule a meeting" → `ACTION_REQUIRED`. "What's our Q3 revenue?" → `INFO_REQUEST`. "This is urgent, call the CEO now" → `ESCALATE`.

---

## Day 3 — September 26 · Research + Draft

**Goal:** ChromaDB retrieval working. Structured draft produced with citations.

### Tasks
- [ ] `backend/knowledge/store.py` — ChromaDB client, `add_documents()`, `search()`
- [ ] `backend/knowledge/seed.py` — Seed a demo knowledge base (company policies, FAQs, team directory — 20–30 chunks)
- [ ] `backend/pipeline/stages/research.py` — Query builder + retrieval + score filtering
- [ ] `backend/pipeline/stages/draft.py` — Structured output: `summary`, `action_items[]`, `caveats[]`, `sources_used[]`
- [ ] Verify: each `ActionItem` has a valid `source_chunk_id` referencing a real retrieved chunk

**Done when:** "Schedule a meeting with the sales team" → draft with `action_items: [{description: "Create calendar invite for sales team", source_chunk_id: "chunk_42", requires_human: false}]`

---

## Day 4 — September 27 · Evaluate + Approve gate

**Goal:** Adversarial self-review working. Approve gate structurally enforced.

### Tasks
- [ ] `backend/pipeline/stages/evaluate.py` — 4 criteria, adversarial prompt, structured `EvaluateResult`
- [ ] Verify adversarial prompt produces different verdicts than a naive "is this good?" prompt
- [ ] `backend/audit/log.py` — Immutable audit record writer (JSON, atomic write)
- [ ] LangGraph edge: EVALUATE → APPROVE (hard dependency — cannot route to EXECUTE without approval state)
- [ ] `backend/pipeline/stages/execute.py` — Stub that checks `approval_decision == "APPROVED"` before doing anything
- [ ] Test: attempt to call execute without approval → raises `PipelineStateError`

**Done when:** Evaluation produces per-criterion PASS/FAIL. Executing without approval raises an error.

---

## Day 5 — September 28 · Frontend

**Goal:** Full UI: mic button → live transcript → pipeline stages → approval UI.

### Tasks
- [ ] `frontend/` — Next.js 15 + Tailwind + TypeScript scaffold
- [ ] `MicCapture.tsx` — Browser mic access, stream audio to backend WebSocket, level meter
- [ ] `LiveTranscript.tsx` — Receives partial + final transcripts over WebSocket, displays in real time
- [ ] `PipelineStatus.tsx` — Shows current stage (LISTEN / PARSE / CLASSIFY / ...) with progress indicator
- [ ] `DraftReview.tsx` — Renders `DraftResult`: summary, action items with source tooltips, caveats
- [ ] `ApprovalGate.tsx` — Three panels: transcript | evaluation verdict | draft. APPROVE / EDIT / REJECT buttons
- [ ] Wire frontend ↔ backend: full flow from mic to approval decision returned

**Done when:** Speak into mic in browser → see transcript appear → pipeline stages light up → approval UI renders → click APPROVE → see "EXECUTING" state.

---

## Day 6 — September 29 · Integration + Demo

**Goal:** Polished, bug-free, demo recorded.

### Tasks
- [ ] End-to-end test: 3 different voice inputs, all 8 stages complete correctly
- [ ] Edge case: low-confidence transcript → caveat surfaced in draft
- [ ] Edge case: AMBIGUOUS classification → pipeline pauses, asks for clarification
- [ ] Edge case: Evaluate returns FAIL → reviewer sees specific failure reason
- [ ] Record demo video — follow `docs/DEMO_SCRIPT.md` exactly (target: 3 minutes)
- [ ] Prepare slide deck (5 slides: Problem / Pipeline / Demo / Why It Wins / Try It)
- [ ] Check: MIT LICENSE in repo, `.env.example` present, no secrets committed
- [ ] Final `git push` — verify GitHub repo looks clean

**Done when:** Video recorded, slides done, repo clean and public.

---

## Day 7 — September 30 · SUBMIT

**Deadline: 11:00 AM EDT — do not leave this until morning**

### Submission checklist (complete night before)
- [ ] Video uploaded (YouTube unlisted or direct upload to lablab.ai)
- [ ] Slides uploaded
- [ ] GitHub repo URL ready: `https://github.com/Emmanuelzyronis/voice-triage`
- [ ] lablab.ai submission form at `lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon`
- [ ] **Submit form by 10:30 AM EDT** (30-minute buffer for any issues)

---

## Contingency

If Day 5 (frontend) takes longer than planned, cut scope to:
- Static approval UI (no live transcript display) — still shows the pipeline result
- WebSocket partial transcript display is a nice-to-have, not a requirement for the pipeline to work

The pipeline correctness (stages 1–8, audit trail, approval gate) is the differentiator. The frontend is the presentation layer. Don't let the frontend block the submission.
