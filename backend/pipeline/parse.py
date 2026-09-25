"""Stage 2 — Parse + Classify: single LLM call extracts intent and assigns category."""

from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI

from backend.config import settings
from backend.models.types import Evidence, ParsedIntent, PipelineState, TriageCategory

logger = logging.getLogger(__name__)

_BASE_SYSTEM = """
You extract structured intent from a voice transcript AND classify it in one pass.
Return JSON only — no prose, no markdown fences.

Schema:
{
  "intent": "<one-line description of what the user wants>",
  "entities": { "<key>": "<value>" },
  "urgency": "low|normal|high|critical",
  "observed": ["<directly stated fact>"],
  "inferred": ["<reasonable interpretation>"],
  "unknown": ["<information gap not in transcript>"],
  "category": "action_required|info_request|escalate|defer|ambiguous",
  "classify_reason": "<one sentence>"
}

Categories:
- action_required: something must be done (dispatch, create, update, schedule)
- info_request: user wants information or a summary
- escalate: requires immediate human expert attention
- defer: low priority, can be queued
- ambiguous: intent cannot be determined

Rules:
- never collapse an unknown into a guess
- keep each array to 3 items max
"""


class ParseStage:
    def __init__(self) -> None:
        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            azure_deployment=settings.azure_openai_deployment,
            api_version=settings.azure_openai_api_version,
            max_tokens=2000,
            reasoning_effort="low",
        )

    def run(self, state: PipelineState) -> PipelineState:
        assert state.transcript is not None, "transcript required"
        state.log("parse: start")

        system = _BASE_SYSTEM
        if state.tenant and state.tenant.ai_instructions:
            system = system.rstrip() + f"\n\nDomain context:\n{state.tenant.ai_instructions}"

        messages = [
            SystemMessage(content=system),
            HumanMessage(content=state.transcript.text),
        ]

        response = self._llm.invoke(messages)
        data: dict = {}
        for attempt in range(2):
            try:
                data = json.loads(response.content)
                break
            except json.JSONDecodeError:
                if attempt == 1:
                    raise
                logger.warning("parse: JSON decode error — retry 1/1")
                response = self._llm.invoke(messages)

        state.parsed = ParsedIntent(
            raw_text=state.transcript.text,
            intent=data["intent"],
            entities=data.get("entities", {}),
            urgency=data.get("urgency", "normal"),
            evidence=Evidence(
                observed=data.get("observed", []),
                inferred=data.get("inferred", []),
                unknown=data.get("unknown", []),
            ),
        )

        # Set category + reason from the combined response so classify stage is a no-op
        try:
            state.category = TriageCategory(data["category"])
        except (KeyError, ValueError):
            state.category = TriageCategory.ACTION_REQUIRED
        state.classify_reason = data.get("classify_reason", "")

        state.log(
            f"parse: intent='{state.parsed.intent}' urgency={state.parsed.urgency} "
            f"category={state.category.value}"
        )
        return state
