# VoiceTriage Pipeline Specification

Full technical specification for the 8-stage agentic pipeline.

---

## Stage 1: LISTEN

**Module:** `backend/stt/assemblyai.py`

### Input
- Raw microphone audio stream (16kHz PCM)

### Output
```python
@dataclass
class TranscriptResult:
    text: str              # Final punctuated transcript
    words: list[Word]      # Word-level timestamps
    confidence: float      # 0.0–1.0
    duration_ms: int       # Total audio duration
    session_id: str        # AssemblyAI session ID
```

### How AssemblyAI is used
Real-time streaming via `assemblyai.RealtimeTranscriber`. Partial results stream over WebSocket to the frontend as the user speaks — users see their words appear in real time. The `on_final` callback fires when AssemblyAI determines the utterance is complete (end of speech detected), delivering the punctuated, capitalised final transcript that triggers the downstream pipeline.

```python
transcriber = aai.RealtimeTranscriber(
    sample_rate=16_000,
    on_data=on_partial,    # → WebSocket → frontend (live display)
    on_final=on_final,     # → pipeline trigger
    on_error=on_error,
)
```

### Failure modes
- **AssemblyAI timeout / connection drop:** Caught in `on_error`. Session marked as FAILED. Frontend shows "Connection lost — please retry." Pipeline does not proceed. No silent data loss.
- **Empty transcript:** If `text.strip() == ""` after final callback, stage returns `TranscriptResult` with `confidence=0.0`. Parse stage treats this as INVALID and routes to DEFER.
- **Low confidence (<0.6):** Surfaced as a caveat in the Draft stage. Human reviewer sees the confidence score.

---

## Stage 2: PARSE

**Module:** `backend/pipeline/stages/parse.py`

### Input
`TranscriptResult` from LISTEN

### Output
```python
@dataclass
class ParseResult:
    intent: str                    # Primary intent verb phrase
    entities: list[Entity]         # Named things: people, dates, topics
    urgency: Literal["HIGH", "MEDIUM", "LOW", "UNKNOWN"]
    raw_transcript: str
    parse_confidence: float        # Model's self-reported confidence
    ambiguities: list[str]         # Things the model couldn't resolve
```

### Design note
Voice input contains filler words, false starts, and implicit references. Parse normalises these into structured fields without losing information. `ambiguities` is a first-class field — if the intent is unclear, that uncertainty surfaces explicitly rather than being collapsed into a best-guess.

---

## Stage 3: CLASSIFY

**Module:** `backend/pipeline/stages/classify.py`

### Input
`ParseResult`

### Output
```python
@dataclass
class ClassifyResult:
    category: Literal[
        "ACTION_REQUIRED",   # Something must be done
        "INFO_REQUEST",      # Answer needed, no action
        "ESCALATE",          # Needs a human immediately
        "DEFER",             # Not urgent, queue for later
        "AMBIGUOUS",         # Cannot determine without more info
    ]
    reasoning: str           # One sentence explaining the classification
    confidence: float
```

### Design note
AMBIGUOUS is a first-class outcome. If the classifier cannot determine the category with confidence > 0.7, it returns AMBIGUOUS and the pipeline halts at the Approve stage to ask the user for clarification — rather than guessing and taking a wrong action.

---

## Stage 4: RESEARCH

**Module:** `backend/pipeline/stages/research.py`

### Input
`ParseResult` + `ClassifyResult`

### Output
```python
@dataclass
class ResearchResult:
    chunks: list[ContextChunk]   # Ranked retrieved passages
    query_used: str              # The semantic query sent to ChromaDB
    total_retrieved: int
    top_score: float             # Similarity score of best match

@dataclass
class ContextChunk:
    text: str
    source: str                  # Document/section reference
    score: float                 # Similarity score
    chunk_id: str
```

### ChromaDB usage
The query is constructed from `intent + key entities`. Top-k=5 chunks retrieved by cosine similarity. Only chunks with `score > 0.5` are passed to Draft — below that threshold the chunk is considered too weak to ground a claim.

### Failure modes
- **Empty knowledge base:** Returns `ResearchResult(chunks=[], ...)`. Draft stage is informed via system prompt that no context is available. Draft must then either request clarification or produce a response with explicit `caveat: "No grounding context available for this query"`.
- **ChromaDB unavailable:** Caught, logged, pipeline continues with empty context and the caveat surfaced in Draft.

---

## Stage 5: DRAFT

**Module:** `backend/pipeline/stages/draft.py`

### Input
`ParseResult` + `ClassifyResult` + `ResearchResult`

### Output — Structured slots (NOT free prose)
```python
@dataclass
class DraftResult:
    summary: str                   # One paragraph: what was asked, what the answer/action is
    action_items: list[ActionItem] # Concrete steps, each with a source citation
    caveats: list[str]             # Limitations, uncertainties, things not covered
    confidence: float              # 0.0–1.0 overall draft confidence
    sources_used: list[str]        # chunk_ids from Research that grounded each claim

@dataclass
class ActionItem:
    description: str
    source_chunk_id: str | None    # Which context chunk grounds this item
    requires_human: bool           # Whether this action needs a human to execute
```

### Why structured output (not free prose)
The Evaluate stage must check whether claims are grounded. With free prose, this is literary analysis — slow, inconsistent, unreliable. With structured slots, it is mechanical: for each `ActionItem`, does `source_chunk_id` reference a real chunk that actually supports `description`? This check is fast, deterministic, and auditable.

Model call: `temperature=0`, `response_format=DraftResult` (Pydantic structured output via Azure OpenAI).

---

## Stage 6: EVALUATE

**Module:** `backend/pipeline/stages/evaluate.py`

### Input
`ParseResult` + `ResearchResult` + `DraftResult`

### Output
```python
@dataclass
class EvaluateResult:
    criteria: list[CriterionVerdict]
    overall: Literal["PASS", "FAIL", "NEEDS_REVISION"]
    revision_notes: str | None     # Only if NEEDS_REVISION or FAIL

@dataclass
class CriterionVerdict:
    criterion: str
    verdict: Literal["PASS", "FAIL", "UNCERTAIN"]
    reasoning: str
```

### Criteria checked
1. **Intent addressed** — Does the draft actually answer/action what was asked?
2. **Factual grounding** — Is every claim in `action_items` traceable to a source chunk?
3. **No overreach** — Does the draft avoid committing to things outside its scope?
4. **Tone** — Is the register appropriate for the urgency and category?

### Adversarial prompt design
The evaluation prompt does NOT ask: "Is this draft good?" It asks:

> "You are a critical reviewer. Find three specific reasons this draft might be wrong or harmful. Then, for each criterion below, assess whether any of your concerns actually apply. Be specific — vague concern is not useful."

This is the difference between a quality check and an actual review. The model is asked to argue against the draft before it makes a final determination. Produces measurably different verdicts than a straightforward approval prompt.

### Failure modes
- **Model returns malformed output:** Retry up to 2 times. If all fail, EvaluateResult defaults to `overall="FAIL"`, `revision_notes="Evaluation model error — human review required"`. Pipeline proceeds to Approve with a prominent warning.

---

## Stage 7: APPROVE

**Module:** Enforced in `backend/pipeline/graph.py` + `frontend/.../ApprovalGate.tsx`

### What the human sees
The approval UI presents three panels side by side:
1. **Original transcript** (verbatim, with AssemblyAI confidence score)
2. **Evaluation verdict** (per-criterion: PASS/FAIL/UNCERTAIN with reasoning)
3. **Draft** (summary, action items with source citations, caveats)

### Human options
- **APPROVE** — proceed to Execute as-is
- **EDIT + APPROVE** — modify draft inline, then approve; edits are logged
- **REJECT** — requires a reason (free text); logged; pipeline ends

### Structural enforcement
There is no code path in `execute.py` that runs unless the pipeline state contains `approval_decision = "APPROVED"`. The graph definition makes this a hard dependency — LangGraph will not route to EXECUTE without it. This is not a UI convention or a flag checked at runtime — it is the graph topology.

### Audit record written at this stage
```python
{
    "session_id": ...,
    "transcript": ...,
    "parse": ...,
    "classify": ...,
    "research": {"query": ..., "chunks_used": [...]},
    "draft": ...,
    "evaluate": ...,
    "approval": {
        "decision": "APPROVED" | "REJECTED",
        "editor_changes": [...],  # diff if edited
        "reason": ...,            # if rejected
        "timestamp": ...,
    }
}
```

---

## Stage 8: EXECUTE

**Module:** `backend/pipeline/stages/execute.py`

### Input
Approved `DraftResult` + full `AuditRecord`

### Actions
Executes each `ActionItem` where `requires_human=False`. Items with `requires_human=True` are queued as tasks in the UI for the human to complete.

### Audit trail
Written atomically before execution. If execution fails mid-way, the partial state is logged and the human is notified — no silent partial execution.

---

## State machine summary

```
LISTEN → PARSE → CLASSIFY → RESEARCH → DRAFT → EVALUATE → APPROVE → EXECUTE
                                ↓                              ↓
                           (AMBIGUOUS)                    (REJECTED)
                               ↓                              ↓
                           Approve:                        Pipeline
                         request clarif.                     ends
```

Every terminal state is explicit. There is no silent failure.
