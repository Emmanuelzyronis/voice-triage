"""Stage 3 — Classify: assign a TriageCategory to the parsed intent."""

from __future__ import annotations

import json
import logging

from langchain_openai import AzureChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from backend.config import settings
from backend.models.types import PipelineState, TriageCategory

logger = logging.getLogger(__name__)

_SYSTEM = """
Classify the user intent into exactly one triage category.
Return JSON only: {"category": "<category>", "reason": "<one sentence>"}

Categories:
- action_required  : something must be done (send, create, update, schedule)
- info_request     : user wants information or a summary
- escalate         : requires immediate human expert attention
- defer            : low priority, can be queued
"""


class ClassifyStage:
    def __init__(self) -> None:
        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            azure_deployment=settings.azure_openai_deployment,
            temperature=0,
        )

    def run(self, state: PipelineState) -> PipelineState:
        assert state.parsed is not None, "parsed intent required"
        state.log("classify: start")

        messages = [
            SystemMessage(content=_SYSTEM),
            HumanMessage(content=f"Intent: {state.parsed.intent}\nUrgency: {state.parsed.urgency}"),
        ]
        response = self._llm.invoke(messages)
        data = json.loads(response.content)

        state.category = TriageCategory(data["category"])
        state.log(f"classify: category={state.category} reason={data['reason']}")
        return state
