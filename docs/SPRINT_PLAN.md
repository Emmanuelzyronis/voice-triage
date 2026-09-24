# ArkOps — Hackathon Sprint Plan (Phase 0)

**Deadline: September 30, 2026 @ 11:00 AM EDT**
**Today: September 24, 2026**
**Days remaining: 6**
**Goal: Prove the engine is real. Ship Phase 0.**

The hackathon submission is Phase 0 of ArkOps — the core pipeline working for a
single demo tenant in the field operations vertical. Everything we build here
is production-intended code, not throwaway demo code.

---

## Day 1 — Sep 24 · Engine Smoke Test

**Goal:** AssemblyAI STT confirmed working. Transcript appears in terminal.

### Tasks
- [x] `backend/` Python project: `pyproject.toml`, venv
- [x] `backend/models/types.py` — full type hierarchy (PipelineState, Evidence, DraftSlots, etc.)
- [x] `backend/pipeline/listen.py` — RealtimeTranscriber, WebSocket + mic modes
- [x] `backend/pipeline/parse.py` — ParseStage, AzureChatOpenAI, evidence taxonomy
- [x] `backend/pipeline/classify.py` — ClassifyStage, TriageCategory
- [x] `backend/pipeline/research.py` — ResearchStage, ChromaDB retrieval
- [x] `backend/pipeline/draft.py` — DraftStage, DraftSlots structured output
- [x] `backend/pipeline/evaluate.py` — EvaluateStage, adversarial self-review
- [x] `backend/pipeline/approve.py` — ApproveStage, async human gate
- [x] `backend/pipeline/execute.py` — ExecuteStage, dispatch on TriageCategory
- [x] `backend/main.py` — FastAPI: WS /ws/audio, POST /approve/{id}, GET /health
- [x] `backend/scripts/test_mic.py` — mic smoke test
- [ ] **Run mic test** → confirm transcript prints to terminal
- [ ] Fix any import / env errors that surface

**Done when:** "Customer calling about broken HVAC, need a tech Thursday" spoken → clean transcript in terminal.

---

## Day 2 — Sep 25 · Tenant Config + Pipeline Wired

**Goal:** Pipeline runs end-to-end for the demo tenant. TenantConfig in every stage.

### Tasks
- [ ] `backend/models/tenant.py` — TenantConfig Pydantic model
  - `tenant_id`, `name`, `ai_instructions`, `approval_rules`, `allowed_categories`, `integrations`
- [ ] `backend/config/tenant_demo.yaml` — Field operations demo tenant
  - AI instructions: HVAC/field-service domain, work-order terminology
  - Approval rules: `action_required → human_required`, `info_request → auto_approve`
  - Integrations: webhook
- [ ] Wire `tenant_id` into `PipelineState`
- [ ] Inject `tenant.ai_instructions` into ParseStage and DraftStage system prompts
- [ ] `backend/knowledge/seed_demo.py` — seed ChromaDB with 20–30 field-ops chunks
  - Company FAQ, dispatch policies, service area, team directory, escalation rules
- [ ] End-to-end test (terminal only, no frontend yet):
  - Hardcode a transcript → run all 8 stages → print PipelineState to stdout
- [ ] Confirm: `APPROVED` state required before ExecuteStage runs

**Done when:** Fixed transcript for field-ops scenario → full PipelineState JSON printed with non-null fields in every stage slot.

---

## Day 3 — Sep 26 · Approval API + Audit Trail

**Goal:** Approval gate testable via curl. Audit log written to disk.

### Tasks
- [ ] `backend/audit/log.py` — write PipelineState as atomic JSON to `audit/` directory
  - File per run: `{state_id}.json`
  - Written before Execute, not after
- [ ] Test `POST /approve/{id}` via curl:
  - `{"status": "approved"}` → pipeline completes
  - `{"status": "rejected", "reviewer_note": "wrong customer"}` → pipeline ends, state logged
  - `{"status": "edited", "edited_body": "..."}` → edited draft used
- [ ] Test timeout: set `APPROVAL_TIMEOUT_SECONDS=10`, let it expire → auto-reject logged
- [ ] `GET /state/{id}` returns full PipelineState JSON (confirm all fields serialise cleanly)
- [ ] `GET /audit/{id}` endpoint to read a completed run's audit record

**Done when:** Three curl scenarios work. Audit JSON written and readable.

---

## Day 4 — Sep 27 · Next.js Frontend

**Goal:** Full approval UI working in browser. End-to-end in the browser, not just terminal.

### Tasks
- [ ] `frontend/` — Next.js 15 + Tailwind + TypeScript
  - `npm create next-app frontend --typescript --tailwind`
- [ ] `MicCapture.tsx` — browser mic access, stream PCM to backend WebSocket, level meter
- [ ] `LiveTranscript.tsx` — receives partial + final transcripts over WS, shows in real time
- [ ] `PipelineStatus.tsx` — stage indicators: LISTEN / PARSE / CLASSIFY / ... lighting up
- [ ] `ApprovalGate.tsx` — three panels:
  - Left: original transcript + confidence
  - Centre: evaluation verdict per criterion (PASS/FAIL)
  - Right: draft (summary, action items, caveats)
  - Buttons: APPROVE / EDIT+APPROVE / REJECT
- [ ] Wire: APPROVE button → `POST /approve/{id}` → pipeline completes → show EXECUTED state
- [ ] Minimal, clean — dark background, clear typography. Not polished, but readable in a demo video.

**Done when:** Speak into browser mic → transcript appears → pipeline stages light up → approval UI renders → click APPROVE → EXECUTED state shown.

---

## Day 5 — Sep 28 · Integration Testing + Demo Prep

**Goal:** Three scenarios recorded cleanly. Slide deck done.

### Tasks
- [ ] **Scenario 1 (main):** "Customer calling about broken HVAC, need emergency tech Thursday, been waiting 3 days"
  - Classify: ACTION_REQUIRED
  - Draft: work order, urgency HIGH, escalation recommended
  - Approve → Execute
- [ ] **Scenario 2 (info request):** "What's our service area for commercial HVAC?"
  - Classify: INFO_REQUEST
  - Draft: pulls knowledge base answer
  - Auto-approve (per tenant approval rule) → Execute immediately
- [ ] **Scenario 3 (ambiguous):** "Send the thing to that customer from earlier"
  - Classify: DEFER or AMBIGUOUS
  - Draft surfaces unknowns: "referent unclear — which customer, which document?"
  - Approve UI shows human what's missing
- [ ] `docs/PITCH.md` — platform vision doc for submission
  - Problem / Engine / Multi-tenant vision / Expansion path / Why ArkOps wins
- [ ] Slide deck (5 slides: Problem / Engine / Demo / Platform Vision / Try It)
- [ ] Verify: MIT LICENSE, `.env.example` present, no secrets in git

**Done when:** All three scenarios run cleanly. Slides drafted.

---

## Day 6 — Sep 29 · Record + Submit Prep

**Goal:** Video recorded. Everything ready to submit by morning.

### Tasks
- [ ] Record demo video — follow `docs/DEMO_SCRIPT.md` exactly (target: 3 minutes)
- [ ] Upload video (YouTube unlisted)
- [ ] Final `git push` — repo public, clean, README accurate
- [ ] lablab.ai submission form:
  - Project name: ArkOps
  - Repo: `https://github.com/Emmanuelzyronis/voice-triage`
  - Video URL
  - Team: Zyronis
- [ ] **Fill form by 10:00 PM — submit by 10:30 PM** (not morning — don't risk it)

---

## Day 7 — Sep 30 · SUBMIT

**Deadline: 11:00 AM EDT — form must be submitted**

- [ ] Confirm submission received on lablab.ai
- [ ] Done

---

## Contingency

If Day 4 (frontend) takes longer than planned:
- Cut live transcript display — show the final transcript only (static, not streaming)
- The approval gate (three panels + buttons) is non-negotiable for the demo
- The pipeline correctness is the differentiator — don't let frontend polish block submission

If Day 5 scenarios reveal pipeline bugs:
- Fix the bug, not the test
- If a stage consistently fails on voice input, add a retry (max 2) before surfacing to human

---

## What Phase 0 Proves

That the engine is real. Specifically:

1. AssemblyAI real-time STT works and produces clean final transcripts
2. Parse extracts structured intent with explicit uncertainty (the evidence taxonomy)
3. Classify routes correctly for multiple input types
4. Draft produces slot-based output — not free prose — grounded in retrieved context
5. Evaluate reviews adversarially before the human sees anything
6. The approval gate cannot be bypassed in code
7. Audit trail is written before execution

Phase 1 (post-hackathon) adds: persistent DB, real phone numbers, Twilio, tenant onboarding, billing.
The code written here is Phase 1's foundation, not throwaway demo code.
