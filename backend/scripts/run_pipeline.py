"""CLI end-to-end pipeline test.

Hardcodes a transcript, runs the full LangGraph pipeline, prints PipelineState JSON.
The approve gate is auto-approved after a short delay so this runs unattended.

Usage:
    python -m backend.scripts.run_pipeline
    python -m backend.scripts.run_pipeline "Customer with no heat, elderly person home"
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime

from backend.models.types import ApprovalStatus, PipelineState, Transcript
from backend.pipeline.approve import ApproveStage
from backend.pipeline.graph import build_graph
from backend.tenants.loader import default_tenant


async def _auto_approve(approve_stage: ApproveStage, delay: float = 1.0) -> None:
    """Submit an approval decision after a short delay — CLI test only."""
    await asyncio.sleep(delay)
    approve_stage.submit_decision(
        status=ApprovalStatus.APPROVED,
        reviewer_note="CLI auto-approve",
    )


async def run(transcript_text: str) -> PipelineState:
    tenant = default_tenant()

    transcript = Transcript(
        session_id="cli-test",
        text=transcript_text,
        is_final=True,
        received_at=datetime.utcnow(),
    )

    state = PipelineState(
        tenant_id=tenant.tenant_id,
        tenant=tenant,
        transcript=transcript,
    )

    approve_stage = ApproveStage()
    graph = build_graph(approve_stage)

    # Start auto-approval in background so the approve gate doesn't block forever
    asyncio.create_task(_auto_approve(approve_stage))

    result = await graph.ainvoke({"pipeline": state})
    return result["pipeline"]


def _json_serialisable(obj: object) -> object:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Not serialisable: {type(obj)}")


if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else (
        "Customer calling about broken HVAC, need emergency tech Thursday"
    )
    print(f"\n{'='*60}")
    print(f"Transcript: {text!r}")
    print(f"{'='*60}\n")

    final = asyncio.run(run(text))

    print(json.dumps(
        final.model_dump(),
        indent=2,
        default=_json_serialisable,
    ))

    print(f"\n{'='*60}")
    print(f"category       : {final.category}")
    print(f"classify_reason: {final.classify_reason}")
    print(f"intent         : {final.parsed.intent if final.parsed else 'N/A'}")
    print(f"evaluation     : {final.evaluation.overall if final.evaluation else 'N/A'}")
    print(f"approval       : {final.approval.status.value if final.approval else 'N/A'}")
    print(f"executed       : {final.executed}")
    if final.executed_result:
        print(f"work_order_ref : {final.executed_result.work_order_ref}")
        print(f"actions taken  : {final.executed_result.action_items_taken}")
    print(f"{'='*60}\n")
