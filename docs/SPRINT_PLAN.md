# ArkOps — Sprint Plan (Phase 0)

**Deadline: September 30, 2026 @ 11:00 AM EDT**
**Submission: lablab.ai AssemblyAI Voice Agent Hackathon**
**Goal: Prove the engine is real. Ship Phase 0.**

Work is organised by layers, not days. Each layer has a gate — a condition that must be
true before the next layer begins. Finish early and you deepen the current layer, not skip
the gate.

---

## Decisions locked

These were decided after a full cross-doc review. They apply everywhere.

| # | Decision |
|---|---|
| 1 | **TenantConfig** — real abstraction, wired into every stage and `PipelineState`. Demo YAML for Apex Field Services. |
| 2 | **EXECUTED** — structured UI panel (action items, work order reference, timestamp). No outbound webhook for Phase 0. |
| 3 | **Partial transcripts** — cut. Frontend shows "Transcribing…" spinner while audio processes, snaps to full text. `DictationTranscriber` stays. |
| 4 | **LangGraph** — build it. Stages become graph nodes. Real branching: `ESCALATE` skips Draft/Evaluate straight to Approve. `AMBIGUOUS` halts at Approve for human clarification. `INFO_REQUEST` routes through auto-approve if tenant rule allows. |
| 5 | **Adversarial eval** — real. Prompt asks model to find 3 specific reasons the draft might be wrong before issuing per-criterion verdicts. |
| 6 | **Audit path** — `audit/{tenant_id}/{state_id}.json`. Tenant-namespaced from day one. |
| 7 | **LLM model** — `gpt-5-mini` everywhere. No `gpt-4o` in any doc or code. |

---

## Layer 0 — Foundation ✅ DONE

### Verified
- [x] Python project: `pyproject.toml`, `.venv`, all dependencies installed
- [x] `backend/.env` — AssemblyAI + Azure OpenAI keys, module-relative path
- [x] `backend/models/types.py` — `PipelineState`, `Evidence`, `DraftSlots`, `Transcript`, all enums
- [x] All 8 pipeline stages scaffolded with real LLM calls (not stubs)
- [x] `backend/main.py` — FastAPI: `WS /ws/audio`, `POST /approve/{id}`, `GET /health`
- [x] AssemblyAI confirmed live: `POST .../transcribe/live → 200 OK`
- [x] Server runs clean, REST + WebSocket endpoints tested

**Gate:** Server returns `{"status": "ok"}`, WebSocket handshake delivers `session_started`. ✅

---

## Layer 1 — Pipeline Engine

Every stage produces real output for a real input. The LangGraph graph defines the routing.
`TenantConfig` flows through every stage. All 8 `PipelineState` slots are non-null by the end.

### Foundations
- [ ] `backend/models/tenant.py` — `TenantConfig` Pydantic model
  ```python
  class TenantConfig(BaseModel):
      tenant_id: str
      name: str
      ai_instructions: str        # injected into Parse + Draft system prompts
      approval_rules: dict        # {"info_request": "auto_approve", "escalate": "human_required", ...}
      allowed_categories: list[TriageCategory]
      integrations: list[str]     # ["webhook"] — Phase 1
  ```
- [ ] Add `AMBIGUOUS` to `TriageCategory` enum in `types.py`
- [ ] Add `tenant_id: str` and `tenant: TenantConfig` to `PipelineState`
  - Default `tenant_id` to empty string so existing `PipelineState()` call in `main.py` still works during migration
- [ ] `backend/tenants/apex_field_services.yaml` — demo tenant config
  - `ai_instructions`: HVAC / field-service domain, work-order vocabulary, Apex Field Services context
  - `approval_rules`: `action_required → human_required`, `info_request → auto_approve`, `escalate → human_required`, `defer → auto_approve`, `ambiguous → human_required`
  - `allowed_categories`: all five
- [ ] `backend/tenants/loader.py` — load `TenantConfig` from YAML by `tenant_id`

### Graph
- [ ] `backend/pipeline/graph.py` — LangGraph `StateGraph` with all 8 nodes
  - Node per stage: `listen`, `parse`, `classify`, `research`, `draft`, `evaluate`, `approve`, `execute`
  - Conditional routing after `classify`:
    - `ACTION_REQUIRED` → `research` → `draft` → `evaluate` → `approve` → `execute`
    - `INFO_REQUEST` → `research` → `draft` → `evaluate` → [`auto_approve` or `approve`] → `execute`
    - `ESCALATE` → `approve` (skip research, draft, evaluate — human sees raw transcript + reason)
    - `DEFER` → `execute` (log to queue, no approval needed)
    - `AMBIGUOUS` → `approve` (halt, human sees what the model couldn't determine)
  - `INFO_REQUEST` auto-approve edge: checks `tenant.approval_rules["info_request"] == "auto_approve"`
  - Replace sequential calls in `main.py` with graph invocation

### Stage fixes
- [ ] **ParseStage** — inject `tenant.ai_instructions` into system prompt
- [ ] **ClassifyStage** — add `classify_reason: str` field to `PipelineState`; store reason, don't just log it
- [ ] **ClassifyStage** — check `allowed_categories`; route unknown categories to `DEFER`
- [ ] **ResearchStage** — namespace ChromaDB collection as `{tenant_id}_knowledge_base`
- [ ] **ResearchStage** — filter results: drop chunks where `relevance_score < 0.5`
- [ ] **DraftStage** — inject `tenant.ai_instructions` into system prompt
- [ ] **All LLM stages** — add JSON retry (max 2 attempts) around `json.loads`; log each retry

### Knowledge base
- [ ] `backend/knowledge/seed_demo.py` — seed `apex_field_services_knowledge_base` ChromaDB collection
  - 20–30 chunks: company FAQ, dispatch policies, service area, team directory, escalation rules
- [ ] Verify retrieval: 3 sample queries return relevant chunks with score > 0.5

### CLI test
- [ ] `backend/scripts/run_pipeline.py` — hardcode a transcript → invoke LangGraph → print `PipelineState` JSON
- [ ] Confirm `ExecuteStage` cannot run without `approval.status == APPROVED` (assert raises, not silent return)

**Gate:** `"Customer calling about broken HVAC, need emergency tech Thursday"` → full `PipelineState`
JSON with all slots non-null, graph route `ACTION_REQUIRED → research → draft → evaluate → approve (pending)`.

---

## Layer 2 — Correctness + Audit

The gate is structurally enforced. Every run produces an immutable audit record. Edge cases tested.

### Enforcement
- [ ] Create `backend/pipeline/errors.py` — define `PipelineStateError`
- [ ] `ExecuteStage.run()` — raise `PipelineStateError` if `approval` is `None` or status is not `APPROVED`/`EDITED`. Not a silent return.
- [ ] Write a test: call `ExecuteStage().run(state)` with no approval decision → must raise `PipelineStateError`

### Evaluate fix
- [ ] **EvaluateStage** — rewrite system prompt to adversarial framing:
  > *"You are an adversarial reviewer. Before assessing each criterion, list three specific
  > reasons this draft might be wrong or misleading given the caller's actual words and the
  > retrieved context. Then, for each criterion, assess whether any of your concerns apply."*
- [ ] **EvaluateStage** — pass `state.context` to the LLM so factual grounding can be checked
- [ ] Verify: run the same transcript with a good draft vs. a deliberately bad one → different `overall` verdicts

### Audit
- [ ] `backend/audit/log.py` — atomic JSON write to `audit/{tenant_id}/{state_id}.json`
  - Written at APPROVE stage, before Execute begins
  - Contents: full `PipelineState` serialised (transcript, parsed, category, reason, context, draft, evaluation, approval)
- [ ] `GET /audit/{state_id}` endpoint — reads and returns the audit file; scoped to `tenant_id` from session

### WebSocket stage events
- [ ] Add per-stage events to `_run_pipeline` in `main.py`:
  ```json
  {"type": "stage_update", "stage": "parse", "status": "running"}
  {"type": "stage_update", "stage": "parse", "status": "complete"}
  ```
  Frontend `PipelineStatus.tsx` depends on these.

### Approval scenarios (curl tests)
- [ ] `{"status": "approved"}` → pipeline completes, `executed=True`, audit written
- [ ] `{"status": "rejected", "reviewer_note": "wrong customer"}` → pipeline ends, audit written, `executed=False`
- [ ] `{"status": "edited", "edited_body": "..."}` → edited body stored, pipeline completes
  - Fix: `main.py` must convert `edited_body: str` → `DraftSlots(body=edited_body)` before passing to `ApprovalDecision`
- [ ] Timeout: `APPROVAL_TIMEOUT_SECONDS=5` → auto-reject fires, audit written

### NEEDS_EDIT behaviour (resolved)
- `overall == "NEEDS_EDIT"` → proceed to Approve with a warning banner. Human sees the issues. Not a blocker, not an auto-loop.

**Gate:** All 4 curl scenarios produce correct state. Audit file exists on disk. `PipelineStateError` raised on unapproved execute. Adversarial eval produces different verdicts for good vs. bad draft.

---

## Layer 3 — Frontend

The full flow runs in a browser. A reviewer can speak, watch the pipeline, and make an
approval decision without touching a terminal.

### Scaffold
- [ ] `frontend/` — Next.js 15 + Tailwind + TypeScript

### Components
- [ ] `MicCapture.tsx` — browser mic access, PCM stream to backend WebSocket, level meter
- [ ] `TranscriptPanel.tsx` — shows "Transcribing…" spinner while audio processes; snaps to full final transcript when ready. No word-by-word streaming.
- [ ] `PipelineStatus.tsx` — stage indicators: LISTEN / PARSE / CLASSIFY / RESEARCH / DRAFT / EVALUATE / APPROVE — each lights up in sequence from WebSocket `stage_update` events
- [ ] `ApprovalGate.tsx` — three panels:
  - **Left**: transcript + classification + reason + urgency
  - **Centre**: evaluation verdict per criterion (addresses_intent / factually_grounded / tone_appropriate, PASS/FAIL), `issues_found` list, `NEEDS_EDIT` warning banner if applicable
  - **Right**: draft (body, action items, caveats). Unknown items from `evidence.unknown` highlighted distinctly.
  - Buttons: APPROVE / EDIT+APPROVE / REJECT
- [ ] `ExecutedPanel.tsx` — shown after APPROVE; displays structured execution result:
  - Action items taken
  - Work order reference (generated `{tenant_id}-{state_id[:8]}`)
  - Timestamp
  - Audit record link
- [ ] Wire: APPROVE → `POST /approve/{id}` → pipeline completes → `ExecutedPanel` renders
- [ ] Wire: `PipelineStatus` updates from `stage_update` WebSocket events

### Routing (LangGraph visibility)
- [ ] ESCALATE route: skip Research/Draft/Evaluate panels; show "ESCALATED — awaiting reviewer decision"
- [ ] AMBIGUOUS route: show "Intent unclear" banner in Approve panel with `evidence.unknown` list
- [ ] DEFER route: skip Approve; show "Deferred — logged to queue"

**Gate:** Speak in browser → "Transcribing…" appears → full transcript snaps in → stage indicators
light up → approval UI renders → click APPROVE → `ExecutedPanel` shown. No terminal required.

---

## Layer 4 — Demo + Submission

Three scenarios. Video recorded. Submitted before deadline.

### Scenarios
- [ ] **Scenario 1 — Action required:**
  *"Customer calling about broken HVAC, need emergency tech Thursday, been waiting 3 days"*
  Route: `ACTION_REQUIRED` → full pipeline → APPROVE → EXECUTED panel
- [ ] **Scenario 2 — Auto-approve info request:**
  *"What's our service area for commercial HVAC?"*
  Route: `INFO_REQUEST` → auto-approve (Apex tenant rule) → EXECUTED immediately — no human click needed
- [ ] **Scenario 3 — Ambiguous:**
  *"Send the thing to that customer from earlier"*
  Route: `AMBIGUOUS` → Approve halts; human sees `evidence.unknown` ("referent unclear — which customer, which document"); REJECT with note

### Polish
- [ ] Verify `evidence.unknown` items are visible and prominent in the approval UI
- [ ] Verify adversarial eval shows specific `issues_found` (not empty) on at least one scenario
- [ ] Verify audit JSON is written after each scenario and contains the expected fields

### Submission
- [ ] MIT LICENSE present, `.env.example` accurate, no secrets in git
- [ ] README Quick Start tested on a clean clone
- [ ] Slide deck (5 slides: Problem / Engine / Demo / Platform Vision / Try It)
- [ ] Record demo video — follow `docs/DEMO_SCRIPT.md` (target: 3 minutes)
- [ ] Upload video (YouTube unlisted)
- [ ] lablab.ai submission form: Project: ArkOps · Repo: `https://github.com/Emmanuelzyronis/voice-triage` · Team: Zyronis

**Hard gate: form submitted by Sep 29, 10:30 PM EDT. Not Sep 30 morning.**

---

## Contingency

**If Layer 3 runs long:**
- Cut ESCALATE + AMBIGUOUS routing in the UI (show generic state)
- Keep the three-panel approval gate — non-negotiable
- The pipeline correctness (LangGraph routing, adversarial eval, structural approval gate) is the differentiator; don't let frontend polish block submission

**If a stage produces bad output on real voice:**
- Fix the prompt/logic, not the test input
- Add retry (max 2) if not already present
- Surface the failure to the human reviewer — never hide it

---

## What Phase 0 Proves

1. AssemblyAI STT works and produces clean final transcripts
2. Parse extracts structured intent with explicit uncertainty (`observed / inferred / unknown`)
3. LangGraph routes correctly — different inputs take different paths through the graph
4. Draft produces slot-based output grounded in retrieved context — not hallucinated prose
5. Evaluate reviews adversarially before the human sees anything
6. The approval gate raises `PipelineStateError` if bypassed — enforced in code, not convention
7. Audit trail written to `audit/{tenant_id}/{state_id}.json` before execution — immutable

Phase 1 (post-hackathon): persistent DB, Twilio, real phone numbers, tenant onboarding, billing.
This code is Phase 1's foundation — not throwaway demo code.
