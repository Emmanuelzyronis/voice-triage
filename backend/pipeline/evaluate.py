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
You are an adversarial reviewer. Before assessing each criterion below, list three
specific reasons this draft might be wrong or misleading given the caller's actual words
and the retrieved context. Be specific — "unclear" is not a finding. Then, for each
criterion, assess whether any of your stated concerns actually apply.

Return JSON only — no prose, no markdown fences.

Schema:
{
  "addresses_intent": true|false,
  "factually_grounded": true|false,
  "tone_appropriate": true|false,
  "issues_found": ["<specific issue — quote draft text and say why it's wrong>"],
  "overall": "PASS|FAIL|NEEDS_EDIT"
}

Rules:
- addresses_intent: does the body actually respond to what the user asked?
- factually_grounded: are all claims supported by the retrieved context? flag unsupported claims
- tone_appropriate: is the tone suitable for the urgency and category?
- issues_found: specific concerns that survive adversarial scrutiny — populated even on PASS
- overall: PASS = ready to execute; NEEDS_EDIT = fixable issue; FAIL = must be redrafted
"""


class EvaluateStage:
    def __init__(self) -> None:
        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            azure_deployment=settings.azure_openai_deployment,
            api_version=settings.azure_openai_api_version,
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
