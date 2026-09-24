"""Approval gate scenario tests — approved / rejected / edited / timeout."""

import asyncio
import pytest

from backend.models.types import (
    ApprovalStatus,
    DraftSlots,
    PipelineState,
    Transcript,
    TriageCategory,
)
from backend.pipeline.approve import ApproveStage
from backend.pipeline.errors import PipelineStateError
from backend.pipeline.execute import ExecuteStage


def _state_ready_for_approval() -> PipelineState:
    state = PipelineState(tenant_id="test-tenant")
    state.transcript = Transcript(session_id="t1", text="test transcript", is_final=True)
    state.category = TriageCategory.ACTION_REQUIRED
    state.draft = DraftSlots(body="We will send a tech.", action_items=["Dispatch technician"])
    return state


# ── Scenario 1: approved ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_approved_executes_successfully() -> None:
    state = _state_ready_for_approval()
    approve = ApproveStage()

    # Submit approval immediately in background
    async def submit():
        await asyncio.sleep(0.05)
        approve.submit_decision(status=ApprovalStatus.APPROVED, reviewer_note="Looks good")

    await asyncio.gather(submit(), approve.run(state))

    assert state.approval is not None
    assert state.approval.status == ApprovalStatus.APPROVED
    assert state.approval.reviewer_note == "Looks good"

    result = ExecuteStage().run(state)
    assert result.executed is True
    assert result.executed_result is not None


# ── Scenario 2: rejected ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rejected_blocks_execute() -> None:
    state = _state_ready_for_approval()
    approve = ApproveStage()

    async def submit():
        await asyncio.sleep(0.05)
        approve.submit_decision(
            status=ApprovalStatus.REJECTED,
            reviewer_note="wrong customer",
        )

    await asyncio.gather(submit(), approve.run(state))

    assert state.approval.status == ApprovalStatus.REJECTED
    assert state.approval.reviewer_note == "wrong customer"

    with pytest.raises(PipelineStateError):
        ExecuteStage().run(state)


# ── Scenario 3: edited ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_edited_body_stored_and_executed() -> None:
    state = _state_ready_for_approval()
    approve = ApproveStage()

    async def submit():
        await asyncio.sleep(0.05)
        approve.submit_decision(
            status=ApprovalStatus.EDITED,
            reviewer_note="corrected body",
            edited_body="Revised: we will send a tech at 2pm.",
        )

    await asyncio.gather(submit(), approve.run(state))

    assert state.approval.status == ApprovalStatus.EDITED
    assert state.approval.edited_draft is not None
    assert state.approval.edited_draft.body == "Revised: we will send a tech at 2pm."

    result = ExecuteStage().run(state)
    assert result.executed is True
    # Edited draft's action_items used (empty since only body was edited)
    assert result.executed_result.action_items_taken == []


# ── Scenario 4: timeout auto-reject ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_timeout_auto_rejects() -> None:
    state = _state_ready_for_approval()
    approve = ApproveStage(timeout_seconds=1)  # 1-second timeout for test speed

    await approve.run(state)  # No decision submitted — should timeout

    assert state.approval is not None
    assert state.approval.status == ApprovalStatus.REJECTED
    assert "Auto-rejected" in state.approval.reviewer_note

    with pytest.raises(PipelineStateError):
        ExecuteStage().run(state)
