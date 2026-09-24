"""LangGraph StateGraph — 8-stage pipeline with conditional routing.

Graph topology:
  LISTEN (external) → PARSE → CLASSIFY → [conditional]
    ACTION_REQUIRED / INFO_REQUEST → RESEARCH → DRAFT → EVALUATE → [auto?] → APPROVE → EXECUTE
    ESCALATE / AMBIGUOUS           → APPROVE (human sees transcript + reason only)
    DEFER                          → EXECUTE (no approval needed)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from backend.models.types import (
    ApprovalDecision,
    ApprovalStatus,
    PipelineState,
    TriageCategory,
)
from backend.pipeline.approve import ApproveStage
from backend.pipeline.classify import ClassifyStage
from backend.pipeline.draft import DraftStage
from backend.pipeline.evaluate import EvaluateStage
from backend.pipeline.execute import ExecuteStage
from backend.pipeline.parse import ParseStage
from backend.pipeline.research import ResearchStage

logger = logging.getLogger(__name__)


class GraphState(TypedDict):
    pipeline: PipelineState


# ── Node functions ────────────────────────────────────────────────────────────

def _parse(gs: GraphState) -> dict:
    return {"pipeline": ParseStage().run(gs["pipeline"])}


def _classify(gs: GraphState) -> dict:
    return {"pipeline": ClassifyStage().run(gs["pipeline"])}


def _research(gs: GraphState) -> dict:
    return {"pipeline": ResearchStage().run(gs["pipeline"])}


def _draft(gs: GraphState) -> dict:
    return {"pipeline": DraftStage().run(gs["pipeline"])}


def _evaluate(gs: GraphState) -> dict:
    return {"pipeline": EvaluateStage().run(gs["pipeline"])}


def _execute(gs: GraphState) -> dict:
    return {"pipeline": ExecuteStage().run(gs["pipeline"])}


# ── Routing logic ─────────────────────────────────────────────────────────────

def _route_after_classify(
    gs: GraphState,
) -> Literal["research", "approve", "execute"]:
    """
    ESCALATE / AMBIGUOUS → approve (skip research / draft / evaluate)
    DEFER                → execute (no approval gate)
    Everything else      → research → draft → evaluate → approve
    """
    category = gs["pipeline"].category
    if category in (TriageCategory.ESCALATE, TriageCategory.AMBIGUOUS):
        return "approve"
    if category == TriageCategory.DEFER:
        # ExecuteStage requires approval — set auto-approval before bypassing the gate.
        gs["pipeline"].approval = ApprovalDecision(
            status=ApprovalStatus.APPROVED,
            reviewer_note="Auto-approved: defer category — no human gate needed",
            decided_at=datetime.utcnow(),
        )
        gs["pipeline"].log("approve: auto-approved — defer category")
        return "execute"
    return "research"


def _route_after_evaluate(
    gs: GraphState,
) -> Literal["approve", "execute"]:
    """INFO_REQUEST with tenant auto_approve rule skips the human gate."""
    pipeline = gs["pipeline"]
    tenant = pipeline.tenant
    if (
        tenant
        and pipeline.category == TriageCategory.INFO_REQUEST
        and tenant.approval_rules.get("info_request") == "auto_approve"
    ):
        pipeline.approval = ApprovalDecision(
            status=ApprovalStatus.APPROVED,
            reviewer_note="Auto-approved: info_request per tenant rule",
            decided_at=datetime.utcnow(),
        )
        pipeline.log("approve: auto-approved — info_request tenant rule")
        return "execute"
    return "approve"


# ── Graph factory ─────────────────────────────────────────────────────────────

def build_graph(approve_stage: ApproveStage):  # noqa: ANN201
    """Build and compile the pipeline graph for one session.

    approve_stage is captured in a closure so it stays out of serialisable state.
    Call graph.ainvoke / graph.astream — the approve node is async.
    """

    async def _approve(gs: GraphState) -> dict:
        return {"pipeline": await approve_stage.run(gs["pipeline"])}

    graph = StateGraph(GraphState)

    graph.add_node("parse", _parse)
    graph.add_node("classify", _classify)
    graph.add_node("research", _research)
    graph.add_node("draft", _draft)
    graph.add_node("evaluate", _evaluate)
    graph.add_node("approve", _approve)
    graph.add_node("execute", _execute)

    graph.set_entry_point("parse")

    graph.add_edge("parse", "classify")
    graph.add_conditional_edges(
        "classify",
        _route_after_classify,
        {"research": "research", "approve": "approve", "execute": "execute"},
    )
    graph.add_edge("research", "draft")
    graph.add_edge("draft", "evaluate")
    graph.add_conditional_edges(
        "evaluate",
        _route_after_evaluate,
        {"approve": "approve", "execute": "execute"},
    )
    graph.add_edge("approve", "execute")
    graph.add_edge("execute", END)

    return graph.compile()
