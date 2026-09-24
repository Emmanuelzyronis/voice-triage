"""Stage 2 — Parse: extract intent and entities from the final transcript."""

from __future__ import annotations

import json
import logging

from langchain_openai import AzureChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from backend.config import settings
from backend.models.types import Evidence, ParsedIntent, PipelineState

logger = logging.getLogger(__name__)

_SYSTEM = """
You extract structured intent from a voice transcript.
Return JSON only — no prose, no markdown fences.

Schema:
{
  "intent": "<one-line description of what the user wants>",
  "entities": { "<key>": "<value>" },
  "urgency": "low|normal|high|critical",
  "observed": ["<directly stated fact>"],
  "inferred": ["<reasonable interpretation — label clearly>"],
  "unknown": ["<information not available in the transcript>"]
}

Rules:
- never collapse an unknown into a guess
- inferred items must be labelled as interpretations, not facts
- unknown items are gaps — surface them explicitly
"""


class ParseStage:
    def __init__(self) -> None:
        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            azure_deployment=settings.azure_openai_deployment,
            temperature=0,
        )

    def run(self, state: PipelineState) -> PipelineState:
        assert state.transcript is not None, "transcript required"
        state.log("parse: start")

        messages = [
            SystemMessage(content=_SYSTEM),
            HumanMessage(content=state.transcript.text),
        ]
        response = self._llm.invoke(messages)
        data = json.loads(response.content)

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
        state.log(f"parse: intent='{state.parsed.intent}' urgency={state.parsed.urgency}")
        return state
