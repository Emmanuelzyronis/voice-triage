"""FastAPI entry point for ArkOps.

Endpoints:
  WS  /ws/audio            — browser streams raw PCM audio; we relay to AssemblyAI
  GET /state/{id}          — current PipelineState for a session
  POST /approve/{id}       — human submits approval decision
  GET  /health             — liveness probe
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.audit.log import read_audit
from backend.config import settings
from backend.models.types import ApprovalStatus, PipelineState, Transcript, TriageCategory
from backend.pipeline import ApproveStage, ListenStage
from backend.pipeline.graph import build_graph
from backend.tenants.loader import default_tenant, load_tenant

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ]
)
logger = structlog.get_logger()

# In-memory store: state_id → (PipelineState, ApproveStage)
_sessions: dict[str, tuple[PipelineState, ApproveStage]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001
    logger.info("arkops starting", assemblyai_key_set=bool(settings.assemblyai_api_key))
    yield
    logger.info("arkops shutting down")


app = FastAPI(title="ArkOps", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/audio")
async def audio_ws(
    ws: WebSocket,
    tenant_id: str = Query(default="apex-field-services"),
) -> None:
    await ws.accept()

    try:
        tenant = load_tenant(tenant_id)
    except FileNotFoundError:
        tenant = default_tenant()
        logger.warning("ws: unknown tenant_id, falling back to default", tenant_id=tenant_id)

    state = PipelineState(tenant_id=tenant.tenant_id, tenant=tenant)
    approve_stage = ApproveStage()
    _sessions[state.id] = (state, approve_stage)

    await ws.send_json({"type": "session_started", "state_id": state.id, "tenant": tenant.name})
    logger.info("ws: session opened", state_id=state.id, tenant=tenant.name)

    loop = asyncio.get_event_loop()

    def on_final(transcript: Transcript) -> None:
        state.transcript = transcript
        asyncio.run_coroutine_threadsafe(
            _run_pipeline(state, approve_stage, ws), loop
        )

    listen = ListenStage(on_final=on_final)
    listen.connect()

    try:
        while True:
            # Accept both bytes (PCM audio) and text ("STOP" signal).
            # receive() is used instead of receive_bytes() so the WS
            # can stay open after the mic stops — pipeline events must
            # still flow back to the browser.
            raw = await ws.receive()
            if raw.get("bytes"):
                listen.stream_bytes(raw["bytes"])
            elif raw.get("text") == "STOP":
                logger.info("ws: received STOP — closing listen", state_id=state.id)
                listen.close()
                break  # stop accepting input; keep WS open for events
    except WebSocketDisconnect:
        logger.info("ws: client disconnected unexpectedly", state_id=state.id)
        listen.close()
        _sessions.pop(state.id, None)


_PIPELINE_NODES = frozenset(
    {"parse", "classify", "research", "draft", "evaluate", "approve", "execute"}
)


async def _run_pipeline(
    state: PipelineState,
    approve_stage: ApproveStage,
    ws: WebSocket,
) -> None:
    """Run stages 2-8 via LangGraph after a final transcript arrives.

    Uses astream_events so each node fires:
      {"type": "stage_update", "stage": "<name>", "status": "running"}
      {"type": "stage_update", "stage": "<name>", "status": "complete"}
    """
    graph = build_graph(approve_stage)
    final_state = state
    approval_event_sent = False
    cur: PipelineState = state

    try:
        async for event in graph.astream_events({"pipeline": state}, version="v2"):
            kind = event["event"]
            name = event.get("name", "")

            if name not in _PIPELINE_NODES:
                continue

            if kind == "on_chain_start":
                await ws.send_json({"type": "stage_update", "stage": name, "status": "running"})

            elif kind == "on_chain_end":
                out = event["data"].get("output", {})
                if isinstance(out, dict) and "pipeline" in out:
                    cur = out["pipeline"]
                    final_state = cur
                    _sessions[cur.id] = (cur, approve_stage)

                await ws.send_json({"type": "stage_update", "stage": name, "status": "complete"})

                # Notify frontend when the approval gate is about to open
                if name == "evaluate" and not approval_event_sent:
                    approval_event_sent = True
                    await ws.send_json({
                        "type": "approval_required",
                        "state_id": cur.id,
                        "category": cur.category.value if cur.category else None,
                        "classify_reason": cur.classify_reason,
                        "parsed": cur.parsed.model_dump() if cur.parsed else {},
                        "draft": cur.draft.model_dump() if cur.draft else {},
                        "evaluation": cur.evaluation.model_dump() if cur.evaluation else {},
                    })
                elif name == "classify" and not approval_event_sent and cur.category in (
                    TriageCategory.ESCALATE, TriageCategory.AMBIGUOUS
                ):
                    # ESCALATE/AMBIGUOUS go straight to approve — no evaluate
                    approval_event_sent = True
                    await ws.send_json({
                        "type": "approval_required",
                        "state_id": cur.id,
                        "category": cur.category.value,
                        "classify_reason": cur.classify_reason,
                        "parsed": cur.parsed.model_dump() if cur.parsed else {},
                        "draft": None,
                        "evaluation": None,
                    })

        await ws.send_json({
            "type": "pipeline_complete",
            "state_id": final_state.id,
            "executed": final_state.executed,
            "approval_status": (
                final_state.approval.status.value if final_state.approval else "none"
            ),
            "executed_result": (
                final_state.executed_result.model_dump()
                if final_state.executed_result else None
            ),
        })
        # Session is no longer needed — safe to clean up now that the
        # browser has received the complete event and can close the WS.
        _sessions.pop(final_state.id, None)

    except Exception as exc:  # noqa: BLE001
        logger.error("pipeline error", state_id=state.id, error=str(exc))
        _sessions.pop(state.id, None)
        try:
            await ws.send_json({"type": "error", "state_id": state.id, "message": str(exc)})
        except Exception:
            pass


# ── REST endpoints ────────────────────────────────────────────────────────────

@app.get("/state/{state_id}")
async def get_state(state_id: str) -> dict[str, Any]:
    entry = _sessions.get(state_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")
    state, _ = entry
    return state.model_dump()


class ApprovalRequest(BaseModel):
    status: str                          # "approved" | "rejected" | "edited"
    reviewer_note: str = ""
    edited_body: str | None = None
    edited_action_items: list[str] = []  # original action items preserved on edit


@app.post("/approve/{state_id}")
async def submit_approval(state_id: str, body: ApprovalRequest) -> dict[str, str]:
    entry = _sessions.get(state_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _, approve_stage = entry

    try:
        status = ApprovalStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}")

    approve_stage.submit_decision(
        status=status,
        reviewer_note=body.reviewer_note,
        edited_body=body.edited_body,
        edited_action_items=body.edited_action_items,
    )
    return {"detail": "decision recorded"}


@app.get("/audit/{state_id}")
async def get_audit(state_id: str) -> dict[str, Any]:
    # Try to find tenant_id from live sessions first (fast path)
    entry = _sessions.get(state_id)
    tenant_id = entry[0].tenant_id if entry else None

    record = read_audit(state_id, tenant_id=tenant_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Audit record not found")
    return record


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
