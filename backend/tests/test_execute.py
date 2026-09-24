"""Tests for ExecuteStage structural enforcement."""

import pytest

from backend.models.types import (
    ApprovalDecision,
    ApprovalStatus,
    DraftSlots,
    PipelineState,
    Transcript,
    TriageCategory,
)
from backend.pipeline.errors import PipelineStateError
from backend.pipeline.execute import ExecuteStage


def _base_state(with_draft: bool = True) -> PipelineState:
    state = PipelineState(tenant_id="test-tenant")
    state.transcript = Transcript(session_id="t1", text="test", is_final=True)
    state.category = TriageCategory.ACTION_REQUIRED
    if with_draft:
        state.draft = DraftSlots(body="Test body", action_items=["Do X"])
    return state


def test_execute_raises_without_approval() -> None:
    """ExecuteStage must raise PipelineStateError when approval is absent."""
    state = _base_state()
    with pytest.raises(PipelineStateError):
        ExecuteStage().run(state)


def test_execute_raises_on_pending_status() -> None:
    """Even a pending ApprovalDecision must not reach Execute."""
    state = _base_state()
    state.approval = ApprovalDecision(status=ApprovalStatus.PENDING)
    with pytest.raises(PipelineStateError):
        ExecuteStage().run(state)


def test_execute_raises_on_rejected_status() -> None:
    state = _base_state()
    state.approval = ApprovalDecision(status=ApprovalStatus.REJECTED, reviewer_note="nope")
    with pytest.raises(PipelineStateError):
        ExecuteStage().run(state)


def test_execute_succeeds_on_approved() -> None:
    state = _base_state()
    state.approval = ApprovalDecision(status=ApprovalStatus.APPROVED)
    result = ExecuteStage().run(state)
    assert result.executed is True
    assert result.executed_result is not None
    assert result.executed_result.work_order_ref == f"test-tenant-{state.id[:8]}"
    assert result.executed_result.action_items_taken == ["Do X"]


def test_execute_succeeds_on_edited() -> None:
    state = _base_state()
    state.approval = ApprovalDecision(
        status=ApprovalStatus.EDITED,
        edited_draft=DraftSlots(body="Edited body", action_items=["Do Y"]),
    )
    result = ExecuteStage().run(state)
    assert result.executed is True
    assert result.executed_result.action_items_taken == ["Do Y"]
