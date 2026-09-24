from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from backend.models.tenant import TenantConfig
from backend.models.types import TriageCategory

_TENANTS_DIR = Path(__file__).parent


@lru_cache(maxsize=32)
def load_tenant(tenant_id: str) -> TenantConfig:
    """Load TenantConfig from YAML. Result is cached per tenant_id."""
    slug = tenant_id.replace("_", "-")
    path = _TENANTS_DIR / f"{slug}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Tenant config not found: {path}")
    with path.open() as f:
        data = yaml.safe_load(f)
    # Convert string category names to TriageCategory enum values
    data["allowed_categories"] = [TriageCategory(c) for c in data["allowed_categories"]]
    return TenantConfig(**data)


def default_tenant() -> TenantConfig:
    return load_tenant("apex-field-services")
