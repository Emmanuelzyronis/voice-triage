"""FastAPI entry point for voice-triage.

Endpoints:
  WS  /ws/audio          — browser streams raw PCM audio; we relay to AssemblyAI
  GET /state/{id}        — get current PipelineState for a session
  POST /approve/{id}     — human submits approval decision
  GET  /health           — liveness probe
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import settings
from backend.models.types import ApprovalStatus, PipelineState, Transcript
from backend.pipeline import (
    ApproveStage,
    ClassifyStage,
    DraftStage,
    EvaluateStage,
    ExecuteStage,
    ListenStage,
    ParseStage,
    ResearchStage,
)

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
    logger.info("voice-triage starting", assemblyai_key_set=bool(settings.assemblyai_api_key))
    yield
    logger.info("voice-triage shutting down")


app = FastAPI(title="voice-triage", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/audio")
async def audio_ws(ws: WebSocket) -> None:
    await ws.accept()
    state = PipelineState()
    approve_stage = ApproveStage()
    _sessions[state.id] = (state, approve_stage)

    await ws.send_json({"type": "session_started", "state_id": state.id})
    logger.info("ws: session opened", state_id=state.id)

    loop = asyncio.get_event_loop()

    def on_final(transcript: Transcript) -> None:
        state.transcript = transcript
        asyncio.run_coroutine_threadsafe(_run_pipeline(state, approve_stage, ws), loop)

    listen = ListenStage(on_final=on_final)
    listen.connect()

    try:
        while True:
            data = await ws.receive_bytes()
            listen.stream_bytes(data)
    except WebSocketDisconnect:
        logger.info("ws: client disconnected", state_id=state.id)
    finally:
        listen.close()
        _sessions.pop(state.id, None)


async def _run_pipeline(
    state: PipelineState,
    approve_stage: ApproveStage,
    ws: WebSocket,
) -> None:
    """Run stages 2-8 after a final transcript arrives."""
    try:
        state = ParseStage().run(state)
        state = ClassifyStage().run(state)
        state = ResearchStage().run(state)
        state = DraftStage().run(state)
        state = EvaluateStage().run(state)

        await ws.send_json({
            "type": "approval_required",
            "state_id": state.id,
            "draft": state.draft.model_dump() if state.draft else {},
            "evaluation": state.evaluation.model_dump() if state.evaluation else {},
        })

        state = await approve_stage.run(state)
        state = ExecuteStage().run(state)

        await ws.send_json({
            "type": "pipeline_complete",
            "state_id": state.id,
            "executed": state.executed,
            "approval_status": state.approval.status.value if state.approval else "none",
        })
    except Exception as exc:  # noqa: BLE001
        logger.error("pipeline error", state_id=state.id, error=str(exc))
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
    status: str          # "approved" | "rejected" | "edited"
    reviewer_note: str = ""
    edited_body: str | None = None


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
    )
    return {"detail": "decision recorded"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
