"""Stage 8 — Execute: act on the approved draft."""

from __future__ import annotations

import logging

from backend.models.types import ApprovalStatus, PipelineState

logger = logging.getLogger(__name__)


class ExecuteStage:
    """Executes actions from the approved draft.

    Currently: logs the full draft to structlog/stdout.
    Extend by registering action handlers keyed on TriageCategory.
    """

    def run(self, state: PipelineState) -> PipelineState:
        assert state.approval is not None, "approval required"

        if state.approval.status != ApprovalStatus.APPROVED and \
                state.approval.status != ApprovalStatus.EDITED:
            state.log(f"execute: skipped — approval={state.approval.status.value}")
            state.executed = False
            return state

        draft = state.approval.edited_draft or state.draft
        assert draft is not None, "no draft to execute"

        state.log("execute: start")
        self._dispatch(state, draft)
        state.executed = True
        state.log("execute: complete")
        return state

    def _dispatch(self, state: PipelineState, draft) -> None:  # noqa: ANN001
        """Route to the appropriate handler based on triage category."""
        from backend.models.types import TriageCategory

        category = state.category
        logger.info(
            "Executing approved response",
            extra={
                "state_id": state.id,
                "category": str(category),
                "body": draft.body,
                "action_items": draft.action_items,
                "caveats": draft.caveats,
            },
        )

        if category == TriageCategory.ACTION_REQUIRED:
            self._handle_action_required(state, draft)
        elif category == TriageCategory.INFO_REQUEST:
            self._handle_info_request(state, draft)
        elif category == TriageCategory.ESCALATE:
            self._handle_escalate(state, draft)
        elif category == TriageCategory.DEFER:
            self._handle_defer(state, draft)

    # ── handlers ─────────────────────────────────────────────────────────────

    def _handle_action_required(self, state: PipelineState, draft) -> None:  # noqa: ANN001
        for item in draft.action_items:
            logger.info("[ACTION] %s | state_id=%s", item, state.id)

    def _handle_info_request(self, state: PipelineState, draft) -> None:  # noqa: ANN001
        logger.info("[INFO] %s | state_id=%s", draft.body, state.id)

    def _handle_escalate(self, state: PipelineState, draft) -> None:  # noqa: ANN001
        logger.warning("[ESCALATE] %s | state_id=%s", draft.body, state.id)

    def _handle_defer(self, state: PipelineState, draft) -> None:  # noqa: ANN001
        logger.info("[DEFER] %s | state_id=%s", draft.body, state.id)
