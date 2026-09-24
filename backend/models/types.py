from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field
import uuid
from datetime import datetime


class TranscriptWord(BaseModel):
    text: str
    start: int  # ms
    end: int    # ms
    confidence: float


class Transcript(BaseModel):
    session_id: str
    text: str
    words: list[TranscriptWord] = []
    is_final: bool = False
    received_at: datetime = Field(default_factory=datetime.utcnow)


class TriageCategory(str, Enum):
    ACTION_REQUIRED = "action_required"   # needs an action to be taken
    INFO_REQUEST    = "info_request"      # user wants information
    ESCALATE        = "escalate"          # needs human expert immediately
    DEFER           = "defer"             # low priority, queue it


class ConfidenceLevel(str, Enum):
    HIGH    = "high"    # 80-100
    MEDIUM  = "medium"  # 50-79
    LOW     = "low"     # 0-49


class ContextItem(BaseModel):
    source: str
    content: str
    relevance_score: float


# Evidence taxonomy — core to the pipeline's explainability
class Evidence(BaseModel):
    observed: list[str] = []    # directly observed facts
    inferred: list[str] = []    # reasonable interpretations, labelled as such
    unknown: list[str] = []     # gaps — never collapsed into false confidence


class ParsedIntent(BaseModel):
    raw_text: str
    intent: str
    entities: dict[str, Any] = {}
    urgency: str = "normal"   # low / normal / high / critical
    evidence: Evidence = Field(default_factory=Evidence)


class DraftSlots(BaseModel):
    """Structured output slots — model fills fields, not free prose."""
    greeting: str = ""
    body: str
    action_items: list[str] = []
    closing: str = ""
    caveats: list[str] = []  # things the model is uncertain about


class EvaluationVerdict(BaseModel):
    addresses_intent: bool
    factually_grounded: bool   # no unsupported claims
    tone_appropriate: bool
    issues_found: list[str] = []
    overall: str  # PASS | FAIL | NEEDS_EDIT


class ApprovalStatus(str, Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EDITED   = "edited"


class ApprovalDecision(BaseModel):
    status: ApprovalStatus
    reviewer_note: str = ""
    edited_draft: DraftSlots | None = None
    decided_at: datetime = Field(default_factory=datetime.utcnow)


class PipelineState(BaseModel):
    """Single object tracking one voice request through all 8 stages."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Stage outputs — None means stage hasn't run yet
    transcript:  Transcript | None = None
    parsed:      ParsedIntent | None = None
    category:    TriageCategory | None = None
    context:     list[ContextItem] = []
    draft:       DraftSlots | None = None
    evaluation:  EvaluationVerdict | None = None
    approval:    ApprovalDecision | None = None
    executed:    bool = False

    # Audit log — every stage appends here
    audit: list[str] = []

    def log(self, entry: str) -> None:
        ts = datetime.utcnow().isoformat()
        self.audit.append(f"[{ts}] {entry}")
