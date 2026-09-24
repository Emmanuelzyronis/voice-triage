# ArkOps Pipeline Specification

Full technical specification for the 8-stage agentic pipeline.
The engine is shared. Tenant configuration is injected per-run, not hardcoded.
LLM: Azure OpenAI `gpt-5-mini`. STT: AssemblyAI `DictationTranscriber`.

---

## Tenant Context

Every pipeline run begins with a `TenantConfig` that shapes stage behaviour:

```python
class TenantConfig(BaseModel):
    tenant_id: str
    name: str
    ai_instructions: str          # injected into Parse + Draft system prompts
    approval_rules: dict          # {"action_required": "human_required", "info_request": "auto_approve", ...}
    allowed_categories: list[TriageCategory]
    integrations: list[str]       # ["webhook"] — Phase 1
```

`PipelineState` carries `tenant_id` and the full `TenantConfig` on every run.
The audit trail is written to `audit/{tenant_id}/{state_id}.json`.
ChromaDB collections are namespaced as `{tenant_id}_knowledge_base`.

---

## Graph Topology (LangGraph)

The pipeline is a `StateGraph` — not a sequential script. Routing after CLASSIFY is conditional.

```
LISTEN → PARSE → CLASSIFY → [conditional]
    ACTION_REQUIRED  → RESEARCH → DRAFT → EVALUATE → APPROVE → EXECUTE
    INFO_REQUEST     → RESEARCH → DRAFT → EVALUATE → [auto_approve?] → APPROVE/EXECUTE
    ESCALATE         → APPROVE (raw transcript only — skip research, draft, eval)
    DEFER            → EXECUTE (log to queue — no approval)
    AMBIGUOUS        → APPROVE (halt — human sees evidence.unknown, decides next step)
```

`INFO_REQUEST` auto-approve edge: checked against `tenant.approval_rules["info_request"]`.
If `"auto_approve"`, the graph bypasses the human wait and proceeds directly to Execute.

Every terminal state is explicit. There is no silent failure.

---

## Stage 1: LISTEN

**Module:** `backend/pipeline/listen.py`
**STT:** `assemblyai.DictationTranscriber` (SDK v1.5.5+)

### Input
Raw 16-bit PCM audio — either:
- Browser chunks streamed over WebSocket (`stream_bytes()`)
- Local microphone (`run_mic()` — dev/test only)

### Behaviour
`DictationTranscriber` uploads audio chunks as they arrive. There are no partial transcript
events. The final transcript is returned when `session.close()` is called and the server
finishes processing.

Frontend behaviour: shows "Transcribing…" spinner from audio start until the final transcript
arrives. Then snaps to the full text. No word-by-word display.

### Output
```python
class Transcript(BaseModel):
    session_id: str       # AssemblyAI session ID
    text: str             # Final punctuated transcript
    words: list[TranscriptWord]
    is_final: bool
    received_at: datetime
```

### Failure modes
- **Empty transcript:** `text.strip() == ""` → pipeline skips downstream stages, human notified
- **AssemblyAI error:** caught in background thread; session marked failed; WebSocket receives error event

---

## Stage 2: PARSE

**Module:** `backend/pipeline/parse.py`
**Model:** `gpt-5-mini`, `temperature=0`

### Input
`Transcript.text` + `TenantConfig.ai_instructions`

### Behaviour
`tenant.ai_instructions` is prepended to the system prompt. This gives the model domain
vocabulary for the tenant's vertical (e.g. "work order", "service call", "dispatch" for field ops).

JSON is parsed with retry (max 2 attempts). On total failure, error surfaced to human reviewer.

### Output
```python
class ParsedIntent(BaseModel):
    raw_text: str
    intent: str                      # one-line: what the caller wants
    entities: dict[str, Any]         # named things: people, dates, equipment, locations
    urgency: str                     # low / normal / high / critical
    evidence: Evidence

class Evidence(BaseModel):
    observed: list[str]              # directly stated facts — verbatim or near-verbatim
    inferred: list[str]              # reasonable interpretations — explicitly labelled
    unknown: list[str]               # gaps — never collapsed into a guess
```

### Evidence taxonomy
`evidence.unknown` travels through every downstream stage.
Unknown items surface as caveats in Draft and are visible in the approval UI.
They are never hidden from the human reviewer.

---

## Stage 3: CLASSIFY

**Module:** `backend/pipeline/classify.py`
**Model:** `gpt-5-mini`, `temperature=0`

### Input
`ParsedIntent`

### Output
```python
class TriageCategory(str, Enum):
    ACTION_REQUIRED = "action_required"   # something must be done
    INFO_REQUEST    = "info_request"      # caller wants information
    ESCALATE        = "escalate"          # needs immediate human attention
    DEFER           = "defer"             # low priority, queue it
    AMBIGUOUS       = "ambiguous"         # intent cannot be determined from transcript

# Stored on PipelineState:
state.category: TriageCategory
state.classify_reason: str   # one sentence — logged AND visible to human reviewer
```

### Tenant routing
After classification, the LangGraph conditional edge checks:
- `tenant.approval_rules[category]` — determines whether human approval is required
- `tenant.allowed_categories` — categories not in this list route to `DEFER`

### Failure modes
- **Malformed JSON:** retry up to 2 times; on total failure default to `ACTION_REQUIRED` (conservative)
- **Low-confidence output:** defaults to `ACTION_REQUIRED`; reason logged

---

## Stage 4: RESEARCH

**Module:** `backend/pipeline/research.py`

### Input
`ParsedIntent.intent` (used as semantic query)

### Behaviour
- ChromaDB collection: `{tenant_id}_knowledge_base`
- Query: `intent` string, top-k = 5
- **Relevance filter:** chunks where `relevance_score < 0.5` are dropped
- Empty result → `context = []`, caveat added to Draft system prompt

### Output
```python
class ContextItem(BaseModel):
    source: str             # document / section reference
    content: str            # retrieved passage
    relevance_score: float  # computed as max(0, 1.0 - (L2_distance / 2.0)) — bounded [0,1]
```

`PipelineState.context: list[ContextItem]`

### Failure modes
- **ChromaDB unavailable:** context empty, caveat surfaced in Draft; pipeline continues
- **All chunks below threshold:** same as empty result

---

## Stage 5: DRAFT

**Module:** `backend/pipeline/draft.py`
**Model:** `gpt-5-mini`, `temperature=0.3`

### Input
`ParsedIntent` + `TriageCategory` + `list[ContextItem]` + `TenantConfig.ai_instructions`

### Output — Structured slots (not free prose)
```python
class DraftSlots(BaseModel):
    greeting: str              # optional opener
    body: str                  # main response / action summary
    action_items: list[str]    # concrete steps that WILL be executed
    closing: str               # optional closing
    caveats: list[str]         # uncertainties, gaps, unresolved unknowns
```

### Rules
- `evidence.unknown` items must each appear as a caveat. The system prompt enforces this.
- No claim may appear in `action_items` that is not supported by retrieved context or `evidence.observed`.
- `tenant.ai_instructions` injected into system prompt for domain vocabulary.

### Failure modes
- **No context retrieved:** system prompt instructs model to surface gaps as caveats, not invent facts
- **Malformed JSON:** retry up to 2 times

---

## Stage 6: EVALUATE

**Module:** `backend/pipeline/evaluate.py`
**Model:** `gpt-5-mini`, `temperature=0`

### Input
`ParsedIntent` + `DraftSlots` + `list[ContextItem]` (context passed so factual grounding can be checked)

### Adversarial prompt design
The prompt does NOT ask: *"Is this draft good?"*

It asks:
> *"You are an adversarial reviewer. Before assessing each criterion below, list three
> specific reasons this draft might be wrong or misleading given the caller's actual words
> and the retrieved context. Be specific — 'unclear' is not a finding. Then, for each
> criterion, assess whether any of your stated concerns actually apply."*

This produces measurably different verdicts from a naive review prompt. The human reviewer
sees specific issues, not vague warnings.

### Output
```python
class EvaluationVerdict(BaseModel):
    addresses_intent: bool       # draft answers what was actually asked
    factually_grounded: bool     # no claims unsupported by retrieved context
    tone_appropriate: bool       # register suits urgency and category
    issues_found: list[str]      # specific issues — populated even on PASS if concerns exist
    overall: str                 # "PASS" | "FAIL" | "NEEDS_EDIT"
```

`NEEDS_EDIT`: proceed to Approve with a warning banner. Not a blocker; not an auto-loop.

### Failure modes
- **Malformed JSON:** retry up to 2 times; on total failure:
  `overall="FAIL"`, `issues_found=["Evaluation model error — human review required"]`
  Pipeline proceeds to Approve with a prominent warning.

---

## Stage 7: APPROVE

**Module:** `backend/pipeline/approve.py`

### What the human sees (three panels)
1. **Left** — original transcript + `classify_reason` + urgency + `evidence.unknown` items highlighted
2. **Centre** — evaluation verdict: per-criterion PASS/FAIL, `issues_found` list, `NEEDS_EDIT` banner if applicable
3. **Right** — draft: body, action items, caveats (caveats shown distinctly)

### Human options
- **APPROVE** — proceed to Execute as drafted
- **EDIT + APPROVE** — modify `body` inline; edit stored as `edited_draft: DraftSlots`
- **REJECT** — requires a non-empty `reviewer_note`; pipeline ends

### ESCALATE / AMBIGUOUS paths
- **ESCALATE:** human sees transcript + reason only (no draft panel). Buttons: APPROVE (page on-call) / REJECT
- **AMBIGUOUS:** human sees transcript + `evidence.unknown` list. Buttons: REJECT with clarification note

### Structural enforcement
There is no code path in `execute.py` that runs without `PipelineState.approval.status == APPROVED`.
`ExecuteStage.run()` raises `PipelineStateError` if approval is absent or not `APPROVED`/`EDITED`.
This is enforced in code, not convention.

The gate is `async` — it awaits an `asyncio.Event` set by `submit_decision()`, called by
`POST /approve/{state_id}`. No polling. No timeout bypass.

Auto-reject after `APPROVAL_TIMEOUT_SECONDS`: logs `"Auto-rejected: no decision within {N}s"`.

### Audit record written here
Written atomically to `audit/{tenant_id}/{state_id}.json` before Execute begins.
```json
{
  "state_id": "...",
  "tenant_id": "...",
  "created_at": "...",
  "transcript": { "text": "...", "session_id": "..." },
  "parsed": { "intent": "...", "urgency": "...", "evidence": { "observed": [], "inferred": [], "unknown": [] } },
  "category": "action_required",
  "classify_reason": "...",
  "context": [ { "source": "...", "content": "...", "relevance_score": 0.87 } ],
  "draft": { "body": "...", "action_items": [...], "caveats": [...] },
  "evaluation": { "overall": "PASS", "issues_found": [] },
  "approval": { "status": "approved", "reviewer_note": "", "edited_draft": null, "decided_at": "..." }
}
```

---

## Stage 8: EXECUTE

**Module:** `backend/pipeline/execute.py`

### Gate
```python
if state.approval is None or state.approval.status not in (ApprovalStatus.APPROVED, ApprovalStatus.EDITED):
    raise PipelineStateError("Execute called without approval — this is a pipeline bug")
```

### Phase 0 behaviour (no outbound integrations yet)
Dispatches on `TriageCategory` and produces a structured `ExecuteResult` written to `PipelineState`:

```python
class ExecuteResult(BaseModel):
    work_order_ref: str          # "{tenant_id}-{state_id[:8]}"
    action_items_taken: list[str]
    executed_at: datetime
    notes: str
```

This result renders in the frontend `ExecutedPanel` — judges see the structured outcome on screen.

Phase 1 adds: real webhook calls, email, Slack, retry with exponential backoff.

### Branches
- `ACTION_REQUIRED` — creates work order record, lists action items taken
- `INFO_REQUEST` — logs response body as information delivered
- `ESCALATE` — logs urgent escalation with on-call note (Phase 1: pages real channel)
- `DEFER` — logs to deferred queue entry

`state.executed = True` only after dispatch completes.

---

## State Machine

```
LISTEN → PARSE → CLASSIFY ──┬── ACTION_REQUIRED ──→ RESEARCH → DRAFT → EVALUATE → APPROVE → EXECUTE
                             ├── INFO_REQUEST ──────→ RESEARCH → DRAFT → EVALUATE → [auto?] → EXECUTE
                             ├── ESCALATE ──────────────────────────────────────→ APPROVE → EXECUTE
                             ├── DEFER ─────────────────────────────────────────────────────→ EXECUTE
                             └── AMBIGUOUS ──────────────────────────────────────→ APPROVE → (REJECT/clarify)

Every terminal state (EXECUTED, REJECTED, DEFERRED, AUTO-REJECTED) is explicit.
There is no silent failure.
```

---

## Tenant Isolation

| Resource | Isolation mechanism |
|---|---|
| `PipelineState` | `tenant_id` field on every record |
| ChromaDB | Collection per tenant: `{tenant_id}_knowledge_base` |
| Audit logs | Directory per tenant: `audit/{tenant_id}/{state_id}.json` |
| LLM prompts | `ai_instructions` injected — no cross-tenant data in prompt |
| Phase 2+ | PostgreSQL RLS on `tenant_id`; per-tenant API keys |
