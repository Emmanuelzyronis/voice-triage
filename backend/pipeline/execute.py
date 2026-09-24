"""Stage 8 — Execute: act on the approved draft."""

from __future__ import annotations

import logging

from backend.models.types import ApprovalStatus, ExecuteResult, PipelineState, TriageCategory
from backend.pipeline.errors import PipelineStateError

logger = logging.getLogger(__name__)


class ExecuteStage:
    def run(self, state: PipelineState) -> PipelineState:
        if state.approval is None or state.approval.status not in (
            ApprovalStatus.APPROVED, ApprovalStatus.EDITED
        ):
            raise PipelineStateError(
                f"Execute called without approval — this is a pipeline bug "
                f"(approval={state.approval.status.value if state.approval else 'None'})"
            )

        # ESCALATE, AMBIGUOUS, and DEFER paths have no draft — that's expected.
        draft = state.approval.edited_draft or state.draft

        state.log("execute: start")
        notes = self._dispatch(state, draft)

        state.executed_result = ExecuteResult(
            work_order_ref=f"{state.tenant_id}-{state.id[:8]}",
            action_items_taken=draft.action_items if draft else [],
            notes=notes,
        )
        state.executed = True
        state.log(f"execute: complete ref={state.executed_result.work_order_ref}")
        from backend.audit.log import finalize_audit
        finalize_audit(state)
        return state

    def _dispatch(self, state: PipelineState, draft) -> str:  # noqa: ANN001
        category = state.category

        logger.info(
            "Executing approved response",
            extra={
                "state_id": state.id,
                "tenant_id": state.tenant_id,
                "category": str(category),
                "work_order_ref": f"{state.tenant_id}-{state.id[:8]}",
                "action_items": draft.action_items,
            },
        )

        if category == TriageCategory.ACTION_REQUIRED:
            return self._handle_action_required(state, draft)
        elif category == TriageCategory.INFO_REQUEST:
            return self._handle_info_request(state, draft)
        elif category == TriageCategory.ESCALATE:
            return self._handle_escalate(state, draft)
        elif category == TriageCategory.DEFER:
            return self._handle_defer(state, draft)
        elif category == TriageCategory.AMBIGUOUS:
            return self._handle_ambiguous(state, draft)
        return "no handler for category"

    def _handle_action_required(self, state: PipelineState, draft) -> str:  # noqa: ANN001
        for item in draft.action_items:
            logger.info("[ACTION] %s | ref=%s-%s", item, state.tenant_id, state.id[:8])
        return f"Work order created with {len(draft.action_items)} action(s)"

    def _handle_info_request(self, state: PipelineState, draft) -> str:  # noqa: ANN001
        logger.info("[INFO] %s | ref=%s-%s", draft.body, state.tenant_id, state.id[:8])
        return "Information response logged"

    def _handle_escalate(self, state: PipelineState, draft) -> str:  # noqa: ANN001
        note = state.approval.reviewer_note if state.approval else ""
        logger.warning("[ESCALATE] reviewer_note=%s | ref=%s-%s", note, state.tenant_id, state.id[:8])
        return f"Escalation recorded — on-call notified. Reviewer: {note or '(no note)'}"

    def _handle_defer(self, state: PipelineState, draft) -> str:  # noqa: ANN001
        body = draft.body if draft else "(deferred without draft)"
        logger.info("[DEFER] %s | ref=%s-%s", body, state.tenant_id, state.id[:8])
        return "Added to deferred queue"

    def _handle_ambiguous(self, state: PipelineState, draft) -> str:  # noqa: ANN001
        note = state.approval.reviewer_note if state.approval else ""
        logger.info("[AMBIGUOUS] reviewer clarified | ref=%s-%s", state.tenant_id, state.id[:8])
        return f"Reviewer note: {note or '(no note)'}"
