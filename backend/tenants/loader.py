from __future__ import annotations

from pathlib import Path

import yaml

from backend.models.tenant import (
    BusinessHours,
    ClassificationCategory,
    ExecutionIntegration,
    TenantConfig,
    VoiceSettings,
)
from backend.models.types import TriageCategory

_TENANTS_DIR = Path(__file__).parent
_cache: dict[str, TenantConfig] = {}


def _parse(data: dict) -> TenantConfig:
    """Coerce raw YAML dict into TenantConfig, handling both old and new schemas."""
    # Legacy: allowed_categories as string list
    if "allowed_categories" in data and data["allowed_categories"]:
        raw = data["allowed_categories"]
        if raw and isinstance(raw[0], str):
            data["allowed_categories"] = [TriageCategory(c) for c in raw]

    # Legacy: integrations list → execution_integration
    if "execution_integration" not in data and "integrations" in data:
        integ_list = data.get("integrations", [])
        if integ_list and integ_list[0] != "webhook":
            data["execution_integration"] = {"type": integ_list[0], "config": {}}

    # Nested models — let Pydantic handle if they're already dicts
    for field, cls in [
        ("voice", VoiceSettings),
        ("business_hours", BusinessHours),
        ("execution_integration", ExecutionIntegration),
    ]:
        if field in data and isinstance(data[field], dict):
            data[field] = cls(**data[field])

    if "classification_categories" in data:
        cats = data["classification_categories"]
        data["classification_categories"] = [
            ClassificationCategory(**c) if isinstance(c, dict) else c for c in cats
        ]

    return TenantConfig(**data)


def load_tenant(tenant_id: str) -> TenantConfig:
    """Load and cache TenantConfig from YAML."""
    slug = tenant_id.replace("_", "-")
    if slug in _cache:
        return _cache[slug]
    path = _TENANTS_DIR / f"{slug}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Tenant config not found: {path}")
    with path.open() as f:
        data = yaml.safe_load(f)
    config = _parse(data)
    _cache[slug] = config
    return config


def list_tenants() -> list[dict]:
    """Return summary list of all available tenants."""
    tenants = []
    for path in sorted(_TENANTS_DIR.glob("*.yaml")):
        try:
            tc = load_tenant(path.stem)
            tenants.append({
                "tenant_id": tc.tenant_id,
                "name": tc.name,
                "vertical": tc.vertical,
                "slug": tc.tenant_id,
            })
        except Exception:
            pass
    return tenants


def default_tenant() -> TenantConfig:
    return load_tenant("apex-field-services")
