"""Stage 6 — Evaluate: adversarial self-review of the draft."""

from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI

from backend.config import settings
from backend.models.types import EvaluationVerdict, PipelineState

logger = logging.getLogger(__name__)

_SYSTEM = """
Review this draft against the original transcript. Return JSON only — no prose, no fences.

Schema:
{
  "addresses_intent": true|false,
  "factually_grounded": true|false,
  "tone_appropriate": true|false,
  "issues_found": ["<specific issue with the draft>"],
  "overall": "PASS|FAIL|NEEDS_EDIT"
}

Rules:
- addresses_intent: does the body respond to what the user actually asked?
- factually_grounded: are all claims supported by the context provided?
- tone_appropriate: is the tone right for the urgency and category?
- issues_found: list only real issues — empty array is fine on PASS
- overall: PASS = ready; NEEDS_EDIT = fixable; FAIL = redraft required
"""


class EvaluateStage:
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
        assert state.parsed is not None, "parsed intent required"
        assert state.draft is not None, "draft required"
        state.log("evaluate: start")

        context_block = "\n".join(
            f"[{item.source}] {item.content}" for item in state.context
        ) or "No retrieved context."

        user_content = (
            f"Original transcript: {state.parsed.raw_text}\n"
            f"Intent: {state.parsed.intent}\n"
            f"Category: {state.category}\n"
            f"Urgency: {state.parsed.urgency}\n\n"
            f"Retrieved context used by the drafter:\n{context_block}\n\n"
            f"Draft:\n"
            f"  body: {state.draft.body}\n"
            f"  action_items: {state.draft.action_items}\n"
            f"  caveats: {state.draft.caveats}"
        )

        messages = [SystemMessage(content=_SYSTEM), HumanMessage(content=user_content)]
        response = self._llm.invoke(messages)

        data: dict = {}
        for attempt in range(2):
            try:
                data = json.loads(response.content)
                break
            except json.JSONDecodeError:
                if attempt == 1:
                    logger.error("evaluate: JSON failed after retry — failing safe")
                    state.evaluation = EvaluationVerdict(
                        addresses_intent=False,
                        factually_grounded=False,
                        tone_appropriate=False,
                        issues_found=["Evaluation model error — human review required"],
                        overall="FAIL",
                    )
                    state.log("evaluate: model error — verdict=FAIL, requires human review")
                    return state
                logger.warning("evaluate: JSON decode error — retry 1/1")
                response = self._llm.invoke(messages)

        state.evaluation = EvaluationVerdict(
            addresses_intent=data["addresses_intent"],
            factually_grounded=data["factually_grounded"],
            tone_appropriate=data["tone_appropriate"],
            issues_found=data.get("issues_found", []),
            overall=data["overall"],
        )
        state.log(f"evaluate: overall={state.evaluation.overall} issues={state.evaluation.issues_found}")
        return state
