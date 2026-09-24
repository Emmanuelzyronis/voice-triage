# ArkOps Pipeline Specification

Full technical specification for the 8-stage agentic pipeline.
This is the shared engine — tenant configuration is injected per-run, not hardcoded.

---

## Tenant Context

Every pipeline run begins with a `TenantConfig` that shapes stage behaviour:

```python
class TenantConfig(BaseModel):
    tenant_id: str
    name: str
    ai_instructions: str          # Injected into Parse and Draft system prompts
    approval_rules: dict          # e.g. {"info_request": "auto_approve", "escalate": "human_required"}
    allowed_categories: list[TriageCategory]
    integrations: list[str]       # e.g. ["webhook", "email"]
```

`PipelineState` carries `tenant_id` on every field. The audit trail is namespaced by tenant.
No stage reads or writes data belonging to another tenant.

---

## Stage 1: LISTEN

**Module:** `backend/pipeline/listen.py`

### Input
Raw audio — either:
- Browser PCM chunks streamed over WebSocket (`stream_bytes()`)
- Local microphone (`run_mic()` — dev/test only)

### Output
```python
class Transcript(BaseModel):
    session_id: str       # AssemblyAI session ID
    text: str             # Final punctuated transcript
    words: list[TranscriptWord]
    is_final: bool
    received_at: datetime
```

### AssemblyAI usage
Real-time streaming via `assemblyai.RealtimeTranscriber`. Partial transcripts stream to the
frontend as the user speaks. The `on_final` callback fires when end-of-speech is detected,
delivering the punctuated final transcript that triggers the downstream pipeline.

### Failure modes
- **Connection drop:** `on_error` catches, session marked FAILED. No silent data loss.
- **Empty transcript:** `text.strip() == ""` → pipeline defers, human notified.
- **Low confidence:** Surfaced as a caveat in Draft. Human sees the score.

---

## Stage 2: PARSE

**Module:** `backend/pipeline/parse.py`

### Input
`Transcript` from LISTEN

### Output
```python
class ParsedIntent(BaseModel):
    raw_text: str
    intent: str                      # One-line description of what the caller wants
    entities: dict[str, Any]         # Named things: people, dates, equipment, addresses
    urgency: str                     # low / normal / high / critical
    evidence: Evidence               # The core taxonomy (see below)

class Evidence(BaseModel):
    observed: list[str]              # Directly stated facts — verbatim or near-verbatim
    inferred: list[str]              # Reasonable interpretations — labelled as such
    unknown: list[str]               # Gaps — never collapsed into a guess
```

### Evidence taxonomy
The `Evidence` model is the trust mechanism of the entire pipeline. Every downstream stage
sees what the model knows (observed), what it is interpreting (inferred), and what it cannot
determine (unknown). Unknown items surface as caveats in Draft and are visible to the human
in the approval UI. They are never hidden.

### Tenant injection
The tenant's `ai_instructions` are prepended to the Parse system prompt, giving the model
domain vocabulary: "This is a field operations company. Callers typically report equipment
failures, request service visits, or ask about scheduling."

### Failure modes
- **Malformed JSON response:** Retry up to 2 times. If all fail, parse error surfaced to human.
- **Intent ambiguous:** Intent set to best interpretation, ambiguity added to `evidence.unknown`.

---

## Stage 3: CLASSIFY

**Module:** `backend/pipeline/classify.py`

### Input
`ParsedIntent`

### Output
```python
class TriageCategory(str, Enum):
    ACTION_REQUIRED = "action_required"   # Something must be done
    INFO_REQUEST    = "info_request"      # Caller wants information
    ESCALATE        = "escalate"          # Needs a human immediately
    DEFER           = "defer"             # Low priority, queue it
```

Classify also produces a `reason: str` — one sentence explaining the classification.
This is logged and shown to the human reviewer.

### Tenant approval rules
The tenant's `approval_rules` dict maps each category to a policy:
- `"human_required"` — must reach ApproveStage with a human decision
- `"auto_approve"` — pipeline can proceed without waiting for human input
- `"skip"` — category not handled by this tenant, defer immediately

### Failure modes
- **Low-confidence classification:** Defaults to `ACTION_REQUIRED` (conservative). Reason logged.
- **Category not in tenant's `allowed_categories`:** Routes to DEFER.

---

## Stage 4: RESEARCH

**Module:** `backend/pipeline/research.py`

### Input
`ParsedIntent` (uses `intent` as the semantic query)

### Output
```python
class ContextItem(BaseModel):
    source: str             # Document / section reference
    content: str            # Retrieved passage
    relevance_score: float  # 1.0 - L2 distance from ChromaDB
```

`PipelineState.context: list[ContextItem]`

### ChromaDB usage
- Collection is namespaced per tenant: `{tenant_id}_knowledge_base`
- Query: `intent` string, top-k=5
- Chunks below relevance threshold (< 0.5) are dropped
- Empty knowledge base → `context = []`, caveat added to Draft

### Failure modes
- **ChromaDB unavailable:** Context empty, caveat surfaced in Draft. Pipeline continues.
- **Empty knowledge base:** Logged, Draft notified via system prompt to surface unknowns.

---

## Stage 5: DRAFT

**Module:** `backend/pipeline/draft.py`

### Input
`ParsedIntent` + `TriageCategory` + `list[ContextItem]`

### Output — Structured slots (NOT free prose)
```python
class DraftSlots(BaseModel):
    greeting: str              # Optional opener
    body: str                  # Main response / action summary
    action_items: list[str]    # Concrete steps that WILL be executed
    closing: str               # Optional closing
    caveats: list[str]         # Uncertainties, gaps, unresolved unknowns
```

### Why structured slots
The Evaluate stage must check whether claims are grounded. With free prose, this is literary
analysis — inconsistent and unreliable. With structured slots, it is mechanical: for each
`action_item`, the evaluator checks whether it is supported by the retrieved context and
consistent with the `evidence.observed` fields. Fast, deterministic, auditable.

`temperature=0.3` — slightly above zero to allow natural phrasing, still near-deterministic.

### Tenant injection
Tenant `ai_instructions` injected into system prompt. Draft uses domain vocabulary and
knows the tenant's typical action categories (work order, service call, escalation, etc.).

### Failure modes
- **No context retrieved:** Draft must produce caveats, not invented facts.
- **Evidence.unknown items:** Each unknown item must appear as a caveat in the draft.

---

## Stage 6: EVALUATE

**Module:** `backend/pipeline/evaluate.py`

### Input
`ParsedIntent` + `DraftSlots` + `list[ContextItem]`

### Output
```python
class EvaluationVerdict(BaseModel):
    addresses_intent: bool       # Draft actually answers what was asked
    factually_grounded: bool     # No claims unsupported by retrieved context
    tone_appropriate: bool       # Register suits urgency and category
    issues_found: list[str]      # Specific issues — not vague warnings
    overall: str                 # PASS | FAIL | NEEDS_EDIT
```

### Adversarial prompt design
The evaluation prompt does NOT ask: "Is this draft good?"

It asks:
> "You are a critical reviewer. Find three specific reasons this draft might be wrong
> or misleading given the caller's actual words. Then, for each criterion, assess whether
> any of your concerns actually apply. Be specific — 'unclear' is not a finding."

This produces measurably different verdicts than a straightforward approval prompt.
The human reviewer sees the specific issue, not a vague warning.

### Failure modes
- **Model returns malformed output:** Retry up to 2 times. If all fail:
  `overall="FAIL"`, `issues_found=["Evaluation model error — human review required"]`
  Pipeline proceeds to Approve with a prominent warning banner.

---

## Stage 7: APPROVE

**Module:** `backend/pipeline/approve.py`

### What the human sees (three panels)
1. **Original transcript** — verbatim, AssemblyAI session ID
2. **Evaluation verdict** — per-criterion: addresses_intent / factually_grounded / tone, issues listed
3. **Draft** — greeting, body, action items, caveats

### Human options
- **APPROVE** — proceed to Execute as drafted
- **EDIT + APPROVE** — modify `body` inline; edit is logged as a diff; proceed to Execute
- **REJECT** — requires a reason (free text); logged; pipeline ends

### Structural enforcement
There is no code path in `execute.py` that runs unless `PipelineState.approval.status == ApprovalStatus.APPROVED`.
The stage is `async` — it awaits `asyncio.Event` set by `submit_decision()`, called by
`POST /approve/{state_id}`. There is no polling, no timeout bypass, no flag that skips this.

If no decision arrives within `APPROVAL_TIMEOUT_SECONDS`, the gate auto-rejects and logs:
`"Auto-rejected: no decision within Ns"`.

### Audit record written at this stage
```json
{
  "state_id": "...",
  "tenant_id": "...",
  "created_at": "...",
  "transcript": { "text": "...", "session_id": "..." },
  "parsed": { "intent": "...", "urgency": "...", "evidence": { ... } },
  "category": "action_required",
  "context": [ { "source": "...", "content": "...", "relevance_score": 0.87 } ],
  "draft": { "body": "...", "action_items": [...], "caveats": [...] },
  "evaluation": { "overall": "PASS", "issues_found": [] },
  "approval": {
    "status": "approved",
    "reviewer_note": "",
    "edited_draft": null,
    "decided_at": "..."
  }
}
```

Written atomically to `audit/{state_id}.json` before Execute begins.

---

## Stage 8: EXECUTE

**Module:** `backend/pipeline/execute.py`

### Input
`PipelineState` with `approval.status == APPROVED`

### Actions
Dispatches on `TriageCategory`:
- `ACTION_REQUIRED` → logs each action item; sends to tenant webhook if configured
- `INFO_REQUEST` → logs response; sends to email/Slack if configured
- `ESCALATE` → logs urgent flag; pages on-call channel
- `DEFER` → logs to deferred queue

`state.executed = True` only after dispatch completes.

### Failure modes
- **Webhook unreachable:** Retry 3 times with exponential backoff. If all fail: logged, human notified.
- **Partial execution:** If multi-step execution fails mid-way, completed steps are logged and
  human is notified. No silent partial execution.

---

## State Machine

```
LISTEN → PARSE → CLASSIFY → RESEARCH → DRAFT → EVALUATE → APPROVE → EXECUTE
                                                               ↓
                                                         (REJECTED)
                                                               ↓
                                                        Pipeline ends,
                                                        audit written

Every terminal state is explicit. There is no silent failure.
```

---

## Tenant Isolation (Phase 2+)

| Resource | Isolation mechanism |
|---|---|
| `PipelineState` | `tenant_id` field on every record; PostgreSQL RLS |
| ChromaDB | Collection per tenant: `{tenant_id}_knowledge_base` |
| Audit logs | Directory per tenant: `audit/{tenant_id}/{state_id}.json` |
| API keys | Per-tenant key, validated on every request |
| LLM calls | Tenant `ai_instructions` injected; no cross-tenant data in prompt |
