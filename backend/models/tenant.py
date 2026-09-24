from __future__ import annotations

from pydantic import BaseModel

from backend.models.types import TriageCategory


class TenantConfig(BaseModel):
    tenant_id: str
    name: str
    ai_instructions: str
    approval_rules: dict[str, str]      # category → "human_required" | "auto_approve"
    allowed_categories: list[TriageCategory]
    integrations: list[str] = []        # ["webhook"] — Phase 1
