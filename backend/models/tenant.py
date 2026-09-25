from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from backend.models.types import TriageCategory


class BusinessHours(BaseModel):
    timezone: str = "America/New_York"
    open_hour: int = 8    # 24h local
    close_hour: int = 18
    days: list[int] = [0, 1, 2, 3, 4]  # 0=Mon … 6=Sun
    emergency_line_24_7: bool = False   # if True, urgent calls always open

    def is_open(self) -> bool:
        tz = ZoneInfo(self.timezone)
        now = datetime.now(tz)
        return now.weekday() in self.days and self.open_hour <= now.hour < self.close_hour


class VoiceSettings(BaseModel):
    voice_id: str = "nova"          # nova | alloy | echo | shimmer | fable | onyx
    speaking_rate: float = 1.0


class ClassificationCategory(BaseModel):
    name: str                        # e.g. "Emergency", "Standard", "Cosmetic"
    description: str                 # shown to LLM for classification
    priority: int = 2               # 1=highest … 3=lowest
    requires_approval: bool = True


class ExecutionIntegration(BaseModel):
    type: str = "none"               # airtable | email | webhook | none
    config: dict[str, Any] = Field(default_factory=dict)


class TenantConfig(BaseModel):
    tenant_id: str
    name: str
    vertical: str = "custom"        # field_service | housing | medical | legal | custom

    # Conversation intake
    ai_instructions: str = ""       # legacy — used if intake_prompt is absent
    intake_prompt: str = ""         # override full LLM system prompt for intake
    required_fields: list[str] = [] # fields that MUST be gathered
    greeting: str = ""              # opening line; computed from name if blank

    # Classification
    allowed_categories: list[TriageCategory] = Field(
        default_factory=lambda: list(TriageCategory)
    )
    classification_categories: list[ClassificationCategory] = Field(
        default_factory=list
    )
    approval_rules: dict[str, str] = Field(
        default_factory=lambda: {
            "action_required": "human_required",
            "info_request": "auto_approve",
            "escalate": "human_required",
            "defer": "auto_approve",
            "ambiguous": "human_required",
        }
    )

    # Voice & scheduling
    voice: VoiceSettings = Field(default_factory=VoiceSettings)
    business_hours: BusinessHours = Field(default_factory=BusinessHours)

    # Execution
    execution_integration: ExecutionIntegration = Field(
        default_factory=ExecutionIntegration
    )
    integrations: list[str] = []    # legacy list — kept for backwards compat

    def effective_greeting(self) -> str:
        return self.greeting or f"Thank you for calling {self.name}. How can I help you today?"

    def is_open(self) -> bool:
        return self.business_hours.is_open()
