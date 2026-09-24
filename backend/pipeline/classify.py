"""Stage 3 — Classify: assign a TriageCategory to the parsed intent."""

from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI

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
- ambiguous        : intent cannot be determined from the transcript
"""


class ClassifyStage:
    def __init__(self) -> None:
        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            azure_deployment=settings.azure_openai_deployment,
            api_version=settings.azure_openai_api_version,
        )

    def run(self, state: PipelineState) -> PipelineState:
        assert state.parsed is not None, "parsed intent required"
        state.log("classify: start")

        messages = [
            SystemMessage(content=_SYSTEM),
            HumanMessage(content=f"Intent: {state.parsed.intent}\nUrgency: {state.parsed.urgency}"),
        ]

        response = self._llm.invoke(messages)
        data: dict = {}
        for attempt in range(2):
            try:
                data = json.loads(response.content)
                break
            except json.JSONDecodeError:
                if attempt == 1:
                    logger.error("classify: JSON failed after retry — defaulting to action_required")
                    data = {"category": "action_required", "reason": "JSON parse failure — conservative default"}
                    break
                logger.warning("classify: JSON decode error — retry 1/1")
                response = self._llm.invoke(messages)

        try:
            category = TriageCategory(data["category"])
        except ValueError:
            logger.warning("classify: unknown category '%s' — defaulting to action_required", data.get("category"))
            category = TriageCategory.ACTION_REQUIRED

        # Tenant gate: reroute disallowed categories to DEFER
        if state.tenant and category not in state.tenant.allowed_categories:
            logger.info("classify: category %s not in tenant.allowed_categories — routing to defer", category)
            state.classify_reason = f"Category '{category.value}' not allowed for tenant — deferred"
            state.category = TriageCategory.DEFER
        else:
            state.category = category
            state.classify_reason = data.get("reason", "")

        state.log(f"classify: category={state.category.value} reason={state.classify_reason!r}")
        return state
