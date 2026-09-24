"""Stage 7 — Approve: human approval gate. Nothing executes without a decision."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from backend.models.types import ApprovalDecision, ApprovalStatus, DraftSlots, PipelineState

logger = logging.getLogger(__name__)


class ApproveStage:
    """Blocks until a human makes a decision via the approve/reject API endpoints.

    The FastAPI layer calls `submit_decision()` when the human acts.
    `run()` awaits `_event` with a configurable timeout.
    """

    def __init__(self, timeout_seconds: int | None = None) -> None:
        from backend.config import settings  # avoid circular at module level

        self._timeout = timeout_seconds or settings.approval_timeout_seconds
        self._event: asyncio.Event = asyncio.Event()
        self._decision: ApprovalDecision | None = None

    def submit_decision(
        self,
        status: ApprovalStatus,
        reviewer_note: str = "",
        edited_body: str | None = None,
    ) -> None:
        """Called by the API layer when the human approves, rejects, or edits."""
        edited_draft: DraftSlots | None = None
        if status == ApprovalStatus.EDITED and edited_body is not None:
            # Shallow edit: only body is editable via the minimal approval UI
            edited_draft = DraftSlots(body=edited_body)

        self._decision = ApprovalDecision(
            status=status,
            reviewer_note=reviewer_note,
            edited_draft=edited_draft,
            decided_at=datetime.utcnow(),
        )
        self._event.set()

    async def run(self, state: PipelineState) -> PipelineState:
        """Async — awaits human decision. Raises TimeoutError if no decision arrives."""
        # ESCALATE and AMBIGUOUS paths reach approve without a draft — that is expected
        state.log(
            f"approve: waiting for human decision "
            f"(category={state.category}, has_draft={state.draft is not None})"
        )

        try:
            await asyncio.wait_for(self._event.wait(), timeout=self._timeout)
        except asyncio.TimeoutError:
            state.log(f"approve: timed out after {self._timeout}s — auto-rejecting")
            state.approval = ApprovalDecision(
                status=ApprovalStatus.REJECTED,
                reviewer_note=f"Auto-rejected: no decision within {self._timeout}s",
            )
            from backend.audit.log import write_audit
            write_audit(state)
            return state

        assert self._decision is not None
        state.approval = self._decision
        state.log(f"approve: decision={self._decision.status.value}")

        # Write audit record atomically before Execute can begin
        from backend.audit.log import write_audit
        write_audit(state)

        return state
