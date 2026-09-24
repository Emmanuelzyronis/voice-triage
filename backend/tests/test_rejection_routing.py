"""Rejection path — graph routes REJECTED → END, pipeline_complete is reachable."""

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


def _rejected_state() -> PipelineState:
    state = PipelineState(tenant_id="test-tenant")
    state.transcript = Transcript(session_id="t1", text="test", is_final=True)
    state.category = TriageCategory.ACTION_REQUIRED
    state.draft = DraftSlots(body="Test body", action_items=["Do X", "Do Y"])
    state.approval = ApprovalDecision(
        status=ApprovalStatus.REJECTED,
        reviewer_note="Wrong property",
    )
    return state


def test_rejected_state_blocks_execute() -> None:
    """ExecuteStage must raise on REJECTED — the graph routes away before this."""
    state = _rejected_state()
    with pytest.raises(PipelineStateError):
        ExecuteStage().run(state)


def test_edited_preserves_action_items() -> None:
    """Edited approval carries original action items through to execute."""
    state = PipelineState(tenant_id="test-tenant")
    state.transcript = Transcript(session_id="t1", text="test", is_final=True)
    state.category = TriageCategory.ACTION_REQUIRED
    state.draft = DraftSlots(body="Original body", action_items=["Do X", "Do Y"])
    state.approval = ApprovalDecision(
        status=ApprovalStatus.EDITED,
        edited_draft=DraftSlots(
            body="Revised body",
            action_items=["Do X", "Do Y"],  # preserved from original
        ),
    )
    result = ExecuteStage().run(state)
    assert result.executed is True
    assert result.executed_result.action_items_taken == ["Do X", "Do Y"]


def test_edited_empty_action_items_still_executes() -> None:
    """Edited approval with no items still executes — empty list is valid."""
    state = PipelineState(tenant_id="test-tenant")
    state.transcript = Transcript(session_id="t1", text="test", is_final=True)
    state.category = TriageCategory.INFO_REQUEST
    state.draft = DraftSlots(body="Info response", action_items=[])
    state.approval = ApprovalDecision(
        status=ApprovalStatus.EDITED,
        edited_draft=DraftSlots(body="Revised info", action_items=[]),
    )
    result = ExecuteStage().run(state)
    assert result.executed is True
    assert result.executed_result.action_items_taken == []
