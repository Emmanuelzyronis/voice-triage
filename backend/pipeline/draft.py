"""Stage 5 — Draft: generate a structured response using DraftSlots."""

from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI

from backend.config import settings
from backend.models.types import DraftSlots, PipelineState

logger = logging.getLogger(__name__)

_SYSTEM = """
You are drafting a response to a voice request. Use the structured slots below.
Return JSON only — no prose, no markdown fences.

Schema:
{
  "greeting": "<optional opener, empty string if not needed>",
  "body": "<main response content>",
  "action_items": ["<specific action 1>", "<specific action 2>"],
  "closing": "<optional closing, empty string if not needed>",
  "caveats": ["<uncertainty or assumption you are making>"]
}

Rules:
- body must directly address the user's intent
- action_items: only list items that WILL be executed, not suggestions
- caveats: list anything you are uncertain about rather than hiding it
- never invent facts not supported by the context provided
"""


class DraftStage:
    def __init__(self) -> None:
        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            azure_deployment=settings.azure_openai_deployment,
            temperature=0.3,
        )

    def run(self, state: PipelineState) -> PipelineState:
        assert state.parsed is not None, "parsed intent required"
        state.log("draft: start")

        context_block = "\n".join(
            f"[{item.source}] {item.content}" for item in state.context
        ) or "No additional context available."

        user_content = (
            f"Intent: {state.parsed.intent}\n"
            f"Category: {state.category}\n"
            f"Urgency: {state.parsed.urgency}\n"
            f"Entities: {json.dumps(state.parsed.entities)}\n"
            f"Known unknowns: {state.parsed.evidence.unknown}\n\n"
            f"Context:\n{context_block}"
        )

        messages = [SystemMessage(content=_SYSTEM), HumanMessage(content=user_content)]
        response = self._llm.invoke(messages)
        data = json.loads(response.content)

        state.draft = DraftSlots(
            greeting=data.get("greeting", ""),
            body=data["body"],
            action_items=data.get("action_items", []),
            closing=data.get("closing", ""),
            caveats=data.get("caveats", []),
        )
        state.log(
            f"draft: {len(state.draft.action_items)} actions, "
            f"{len(state.draft.caveats)} caveats"
        )
        return state
