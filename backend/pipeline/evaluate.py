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
You are a strict reviewer. Evaluate the draft response against the original intent.
Return JSON only — no prose, no markdown fences.

Schema:
{
  "addresses_intent": true|false,
  "factually_grounded": true|false,
  "tone_appropriate": true|false,
  "issues_found": ["<specific issue>"],
  "overall": "PASS|FAIL|NEEDS_EDIT"
}

Rules:
- addresses_intent: does the body actually respond to what the user asked?
- factually_grounded: are all claims supported by the provided context? flag any that aren't
- tone_appropriate: is the tone suitable for the category (action_required/info_request/etc)?
- issues_found: be specific — vague ("unclear") is not useful
- overall: PASS = ready; NEEDS_EDIT = fixable; FAIL = must redraft
"""


class EvaluateStage:
    def __init__(self) -> None:
        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            azure_deployment=settings.azure_openai_deployment,
            temperature=0,
        )

    def run(self, state: PipelineState) -> PipelineState:
        assert state.parsed is not None, "parsed intent required"
        assert state.draft is not None, "draft required"
        state.log("evaluate: start")

        user_content = (
            f"Original intent: {state.parsed.intent}\n"
            f"Category: {state.category}\n\n"
            f"Draft:\n"
            f"  greeting: {state.draft.greeting}\n"
            f"  body: {state.draft.body}\n"
            f"  action_items: {state.draft.action_items}\n"
            f"  closing: {state.draft.closing}\n"
            f"  caveats: {state.draft.caveats}"
        )

        messages = [SystemMessage(content=_SYSTEM), HumanMessage(content=user_content)]
        response = self._llm.invoke(messages)
        data = json.loads(response.content)

        state.evaluation = EvaluationVerdict(
            addresses_intent=data["addresses_intent"],
            factually_grounded=data["factually_grounded"],
            tone_appropriate=data["tone_appropriate"],
            issues_found=data.get("issues_found", []),
            overall=data["overall"],
        )
        state.log(f"evaluate: overall={state.evaluation.overall} issues={state.evaluation.issues_found}")
        return state
