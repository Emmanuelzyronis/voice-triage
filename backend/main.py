"""FastAPI entry point for ArkOps.

Endpoints:
  WS  /ws/conversation        — multi-turn voice conversation → pipeline
  WS  /ws/audio               — legacy single-utterance mode
  GET /state/{id}             — current PipelineState for a session
  POST /approve/{id}          — human submits approval decision
  GET  /audit/{id}            — audit record for a completed session
  GET  /health                — liveness probe
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

import httpx
import structlog
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from backend.audit.log import read_audit
from backend.config import settings
from backend.models.types import ApprovalStatus, PipelineState, Transcript, TriageCategory
from backend.pipeline import ApproveStage, ListenStage
from backend.pipeline.conversation import ConversationSession
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


app = FastAPI(title="ArkOps", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Conversational WebSocket endpoint ─────────────────────────────────────────

@app.websocket("/ws/conversation")
async def conversation_ws(
    ws: WebSocket,
    tenant_id: str = Query(default="apex-field-services"),
) -> None:
    """Multi-turn voice conversation → pipeline → human approval."""
    await ws.accept()

    try:
        tenant = load_tenant(tenant_id)
    except FileNotFoundError:
        tenant = default_tenant()
        logger.warning("ws: unknown tenant_id, falling back to default", tenant_id=tenant_id)

    state = PipelineState(tenant_id=tenant.tenant_id, tenant=tenant)
    approve_stage = ApproveStage()
    _sessions[state.id] = (state, approve_stage)

    await ws.send_json({
        "type": "session_started",
        "state_id": state.id,
        "tenant": tenant.name,
    })
    logger.info("conversation_ws: session opened", state_id=state.id)

    loop = asyncio.get_event_loop()
    pipeline_done = asyncio.Event()

    # ── Callbacks (all async, called via run_coroutine_threadsafe) ─────────────

    async def on_partial(text: str) -> None:
        await ws.send_json({"type": "user_partial", "text": text})

    async def on_user_turn(text: str) -> None:
        await ws.send_json({"type": "conversation_turn", "role": "user", "text": text})

    async def on_ai_turn(text: str) -> None:
        await ws.send_json({"type": "conversation_turn", "role": "assistant", "text": text})

    async def on_complete(ai_final: str, transcript: str) -> None:
        """Conversation finished — send final AI line, then run the pipeline."""
        await ws.send_json({"type": "conversation_turn", "role": "assistant", "text": ai_final})
        await ws.send_json({"type": "conversation_complete", "state_id": state.id})

        # Build a synthetic Transcript from the full conversation
        state.transcript = Transcript(
            session_id=state.id,
            text=transcript,
            words=[],
            is_final=True,
        )
        await _run_pipeline(state, approve_stage, ws, pipeline_done)

    async def on_error(message: str) -> None:
        _sessions.pop(state.id, None)
        try:
            await ws.send_json({"type": "error", "state_id": state.id, "message": message})
        except Exception:
            pass
        pipeline_done.set()

    # ── Start conversation ─────────────────────────────────────────────────────

    session = ConversationSession(
        tenant=tenant,
        loop=loop,
        on_partial=on_partial,
        on_user_turn=on_user_turn,
        on_ai_turn=on_ai_turn,
        on_complete=on_complete,
        on_error=on_error,
    )

    try:
        session.connect()
    except Exception as exc:
        logger.error("conversation_ws: failed to connect to AssemblyAI", error=str(exc))
        await ws.send_json({"type": "error", "message": f"STT connection failed — {exc}"})
        _sessions.pop(state.id, None)
        return

    # Send greeting
    greeting = session.agent.greeting
    await ws.send_json({"type": "conversation_turn", "role": "assistant", "text": greeting})

    try:
        while True:
            raw = await ws.receive()
            if raw.get("bytes"):
                session.stream_bytes(raw["bytes"])
            elif raw.get("text") == "STOP":
                logger.info("conversation_ws: STOP received", state_id=state.id)
                session.close()
                # Wait for pipeline to finish; timeout as safety net
                try:
                    await asyncio.wait_for(pipeline_done.wait(), timeout=300.0)
                except asyncio.TimeoutError:
                    logger.warning("conversation_ws: pipeline_done timeout", state_id=state.id)
                    _sessions.pop(state.id, None)
                break
    except WebSocketDisconnect:
        logger.info("conversation_ws: client disconnected", state_id=state.id)
        session.close()
        _sessions.pop(state.id, None)


# ── Legacy single-utterance WebSocket endpoint ─────────────────────────────────

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
    pipeline_done = asyncio.Event()

    def on_final(transcript: Transcript) -> None:
        state.transcript = transcript
        asyncio.run_coroutine_threadsafe(
            _run_pipeline(state, approve_stage, ws, pipeline_done), loop
        )

    def on_empty(reason: str) -> None:
        _sessions.pop(state.id, None)

        async def _send_and_signal() -> None:
            try:
                await ws.send_json({"type": "error", "state_id": state.id, "message": reason})
            finally:
                pipeline_done.set()

        asyncio.run_coroutine_threadsafe(_send_and_signal(), loop)

    listen = ListenStage(on_final=on_final, on_empty=on_empty)
    listen.connect()

    try:
        while True:
            raw = await ws.receive()
            if raw.get("bytes"):
                listen.stream_bytes(raw["bytes"])
            elif raw.get("text") == "STOP":
                logger.info("ws: received STOP", state_id=state.id)
                listen.close()
                await pipeline_done.wait()
                break
    except WebSocketDisconnect:
        logger.info("ws: client disconnected unexpectedly", state_id=state.id)
        listen.close()
        _sessions.pop(state.id, None)


# ── Shared pipeline runner ─────────────────────────────────────────────────────

_PIPELINE_NODES = frozenset(
    {"parse", "classify", "research", "draft", "evaluate", "approve", "execute"}
)


async def _run_pipeline(
    state: PipelineState,
    approve_stage: ApproveStage,
    ws: WebSocket,
    done: asyncio.Event | None = None,
) -> None:
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
        _sessions.pop(final_state.id, None)

    except Exception as exc:  # noqa: BLE001
        logger.error("pipeline error", state_id=state.id, error=str(exc))
        _sessions.pop(state.id, None)
        try:
            await ws.send_json({"type": "error", "state_id": state.id, "message": str(exc)})
        except Exception:
            pass
    finally:
        if done is not None:
            done.set()


# ── TTS endpoint ──────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"


@app.post("/tts")
async def text_to_speech(body: TTSRequest) -> Response:
    """Proxy to Azure OpenAI TTS — returns MP3 audio bytes."""
    url = (
        f"{settings.azure_openai_endpoint.rstrip('/')}/openai/deployments/"
        f"{settings.azure_tts_deployment}/audio/speech"
        f"?api-version={settings.azure_openai_api_version}"
    )
    payload = {
        "model": settings.azure_tts_deployment,
        "input": body.text,
        "voice": body.voice,
        "response_format": "mp3",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"api-key": settings.azure_openai_api_key},
        )
    if resp.status_code != 200:
        logger.error("TTS error", status=resp.status_code, body=resp.text)
        raise HTTPException(status_code=502, detail=f"TTS failed: {resp.text}")
    return Response(content=resp.content, media_type="audio/mpeg")


# ── REST endpoints ─────────────────────────────────────────────────────────────

@app.get("/state/{state_id}")
async def get_state(state_id: str) -> dict[str, Any]:
    entry = _sessions.get(state_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")
    state, _ = entry
    return state.model_dump()


class ApprovalRequest(BaseModel):
    status: str
    reviewer_note: str = ""
    edited_body: str | None = None
    edited_action_items: list[str] = []


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
    entry = _sessions.get(state_id)
    tenant_id = entry[0].tenant_id if entry else None
    record = read_audit(state_id, tenant_id=tenant_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Audit record not found")
    return record


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
