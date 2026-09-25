"""Conversational intake agent — multi-turn voice dialogue before the pipeline."""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from collections.abc import Callable

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI

from assemblyai.streaming.v3 import (
    StreamingClient,
    StreamingClientOptions,
    StreamingEvents,
    StreamingParameters,
    TurnEvent,
)
from assemblyai.streaming.v3.models import NoiseSuppressionModel, RealTimeSessionParameters, StreamingMode

from backend.config import settings
from backend.tenants.loader import TenantConfig

logger = logging.getLogger(__name__)

_MAX_TURNS = 6  # stop asking after this many user turns

_SYSTEM_BASE = """\
{intake_prompt}

Required information to collect before completing:
{required_fields_list}

Optional (collect only if the caller volunteers it):
- Caller name, best callback number, preferred timing

{after_hours_note}

Conversation so far:
{history}

User turns so far: {turn_count} (max {max_turns})

Respond with JSON only:
{{"action": "ask|complete", "message": "<1-2 natural sentences>"}}

- "ask"      → still missing required info; message is ONE follow-up question
- "complete" → all required info gathered, OR turn_count >= {max_turns}

Never ask two questions at once. Sound human, not robotic.
"""

_FALLBACK_INTAKE_PROMPT = """\
You are a voice intake agent for {tenant_name}. Conduct a brief, warm call
to gather the information needed to log a service request.

{ai_instructions}
"""


def _build_system_prompt(tenant: TenantConfig, turn_count: int, history: str) -> str:
    """Build the intake system prompt from tenant config."""
    if tenant.intake_prompt:
        intake = tenant.intake_prompt.strip()
    else:
        intake = _FALLBACK_INTAKE_PROMPT.format(
            tenant_name=tenant.name,
            ai_instructions=(tenant.ai_instructions or "").strip(),
        ).strip()

    required = tenant.required_fields or ["issue description", "location or contact info"]
    fields_list = "\n".join(f"- {f.replace('_', ' ').title()}" for f in required)

    after_hours = ""
    if not tenant.is_open() and not tenant.business_hours.emergency_line_24_7:
        after_hours = (
            "NOTE: We are currently outside business hours. "
            "In addition to the required fields, ask for a preferred callback time and number."
        )
    elif not tenant.is_open() and tenant.business_hours.emergency_line_24_7:
        after_hours = (
            "NOTE: We are currently outside regular business hours. "
            "For non-emergency requests, ask for a preferred callback time. "
            "For emergencies, proceed normally."
        )

    return _SYSTEM_BASE.format(
        intake_prompt=intake,
        required_fields_list=fields_list,
        after_hours_note=after_hours,
        history=history,
        turn_count=turn_count,
        max_turns=_MAX_TURNS,
    )


class ConversationAgent:
    """LLM-driven agent that conducts multi-turn intake turns."""

    def __init__(self, tenant: TenantConfig) -> None:
        self.tenant = tenant
        self.turns: list[dict[str, str]] = []
        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            azure_deployment=settings.azure_openai_deployment,
            api_version=settings.azure_openai_api_version,
            max_tokens=2000,
            reasoning_effort="low",
        )

    @property
    def greeting(self) -> str:
        return self.tenant.effective_greeting()

    def process_turn(self, user_text: str) -> tuple[str, bool]:
        """Process one user turn. Returns (ai_response_text, is_complete)."""
        self.turns.append({"role": "user", "text": user_text})

        user_turn_count = sum(1 for t in self.turns if t["role"] == "user")
        history_lines = [
            f"{'Customer' if t['role'] == 'user' else 'Agent'}: {t['text']}"
            for t in self.turns
        ]

        prompt = _build_system_prompt(
            tenant=self.tenant,
            turn_count=user_turn_count,
            history="\n".join(history_lines),
        )

        response = self._llm.invoke([SystemMessage(content=prompt)])
        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            data = {
                "action": "complete",
                "message": "Thank you, I have enough to log your request now.",
            }

        ai_text = data.get("message", "Thank you, logging your request now.")
        is_complete = data.get("action") == "complete" or user_turn_count >= _MAX_TURNS

        self.turns.append({"role": "assistant", "text": ai_text})
        return ai_text, is_complete

    def build_transcript_text(self) -> str:
        """Format conversation as a labelled transcript for the pipeline."""
        lines = [
            f"{'Customer' if t['role'] == 'user' else 'Agent'}: {t['text']}"
            for t in self.turns
        ]
        return "\n".join(lines)


class ConversationSession:
    """Wraps AssemblyAI v3 streaming + ConversationAgent into a call session.

    All callbacks are async coroutines called via run_coroutine_threadsafe
    from the SDK's internal receiver thread.
    """

    def __init__(
        self,
        tenant: TenantConfig,
        loop: asyncio.AbstractEventLoop,
        on_partial: Callable,       # async (text: str) -> None
        on_user_turn: Callable,     # async (text: str) -> None
        on_ai_turn: Callable,       # async (text: str) -> None
        on_complete: Callable,      # async (ai_final: str, transcript: str) -> None
        on_error: Callable,         # async (message: str) -> None
    ) -> None:
        self.agent = ConversationAgent(tenant)
        self._loop = loop
        self._on_partial = on_partial
        self._on_user_turn = on_user_turn
        self._on_ai_turn = on_ai_turn
        self._on_complete = on_complete
        self._on_error = on_error
        self._client: StreamingClient | None = None
        self._processing = False
        self._last_ai_response: str = ""

    def connect(self) -> None:
        self._client = StreamingClient(
            StreamingClientOptions(
                api_key=settings.assemblyai_api_key,
                api_host="streaming.assemblyai.com",
            )
        )
        self._client.on(StreamingEvents.Turn, self._handle_turn)
        self._client.on(StreamingEvents.Error, self._handle_error)
        self._client.on(StreamingEvents.Termination, self._handle_termination)
        self._client.connect(
            StreamingParameters(
                sample_rate=16000,
                speech_model="universal-3-5-pro",
                continuous_partials=True,
                mode=StreamingMode.min_latency,
                voice_focus=NoiseSuppressionModel.near_field,
            )
        )
        logger.info("ConversationSession: AssemblyAI v3 connected")

    def stream_bytes(self, chunk: bytes) -> None:
        if self._client:
            self._client.stream(chunk)

    def update_agent_context(self, ai_response: str) -> None:
        """Push the AI's last response to AssemblyAI for Context Carryover (13.7% WER improvement)."""
        if self._client and ai_response:
            try:
                self._client.set_params(RealTimeSessionParameters(agent_context=ai_response))
            except Exception as exc:
                logger.debug("agent_context update failed: %s", exc)

    def close(self) -> None:
        if self._client:
            try:
                self._client.disconnect(terminate=True)
            except Exception:
                pass
            self._client = None

    def _run(self, coro) -> None:
        """Schedule a coroutine on the main event loop from a background thread."""
        asyncio.run_coroutine_threadsafe(coro, self._loop)

    def _run_and_wait(self, coro, timeout: float = 30.0):
        """Schedule a coroutine and block until it completes (for LLM calls)."""
        fut = asyncio.run_coroutine_threadsafe(coro, self._loop)
        fut.result(timeout=timeout)

    def _handle_termination(self, _client, event) -> None:
        """Called when the AssemblyAI session closes (after disconnect).
        If no conversation completed, signal on_error so pipeline_done is set."""
        if not self.agent.turns:
            self._run(self._on_error("Call ended before any speech was detected"))

    def _handle_error(self, _client, event) -> None:
        self._run(self._on_error(str(event)))

    def _handle_turn(self, _client, event: TurnEvent) -> None:
        if not event.end_of_turn:
            if event.transcript.strip():
                self._run(self._on_partial(event.transcript))
            return

        text = event.transcript.strip()
        if not text or self._processing:
            return

        self._processing = True
        threading.Thread(target=self._process_turn, args=(text,), daemon=True).start()

    def _process_turn(self, user_text: str) -> None:
        try:
            self._run_and_wait(self._on_user_turn(user_text))
            ai_text, is_complete = self.agent.process_turn(user_text)
            self._last_ai_response = ai_text

            # Feed AI response back to AssemblyAI for Context Carryover
            self.update_agent_context(ai_text)

            if is_complete:
                transcript = self.agent.build_transcript_text()
                self._run_and_wait(self._on_complete(ai_text, transcript))
            else:
                self._run_and_wait(self._on_ai_turn(ai_text))
        except Exception as exc:
            logger.error("ConversationSession: turn error: %s", exc)
            self._run(self._on_error(str(exc)))
        finally:
            self._processing = False
