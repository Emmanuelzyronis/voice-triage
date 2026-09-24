"""Audit trail — atomic JSON write to audit/{tenant_id}/{state_id}.json.

Written in two phases:
  1. At APPROVE (after decision, before Execute): captures transcript → evaluation → approval.
  2. At EXECUTE completion: `finalize_audit` patches `executed_result` into the file.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_AUDIT_ROOT = Path(__file__).parent.parent.parent / "audit"


def _serialisable(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Not JSON-serialisable: {type(obj)!r}")


def write_audit(state: Any) -> Path:  # noqa: ANN401 — avoids circular import
    """Write audit record atomically. Returns the file path. Idempotent."""
    tenant_id: str = getattr(state, "tenant_id", "") or "unknown"
    state_id: str = state.id

    dest_dir = _AUDIT_ROOT / tenant_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{state_id}.json"

    if dest.exists():
        logger.debug("audit: file already exists — skipping write (%s)", dest)
        return dest

    record = {
        "state_id": state_id,
        "tenant_id": tenant_id,
        "created_at": state.created_at,
        "transcript": state.transcript.model_dump() if state.transcript else None,
        "parsed": state.parsed.model_dump() if state.parsed else None,
        "category": state.category.value if state.category else None,
        "classify_reason": state.classify_reason,
        "context": [c.model_dump() for c in state.context],
        "draft": state.draft.model_dump() if state.draft else None,
        "evaluation": state.evaluation.model_dump() if state.evaluation else None,
        "approval": state.approval.model_dump() if state.approval else None,
        "executed_result": None,  # patched by finalize_audit() after Execute
        "audit_log": state.audit,
    }

    payload = json.dumps(record, indent=2, default=_serialisable)

    # Atomic write: temp file in same directory → os.replace (same-filesystem rename)
    with tempfile.NamedTemporaryFile(
        mode="w", dir=dest_dir, suffix=".tmp", delete=False
    ) as tmp:
        tmp.write(payload)
        tmp_path = tmp.name

    os.replace(tmp_path, dest)
    logger.info("audit: written %s", dest)
    return dest


def finalize_audit(state: Any) -> None:
    """Patch executed_result into an existing audit file. No-op if file missing."""
    if not state.executed_result:
        return
    tenant_id: str = getattr(state, "tenant_id", "") or "unknown"
    dest = _AUDIT_ROOT / tenant_id / f"{state.id}.json"
    if not dest.exists():
        return
    try:
        record = json.loads(dest.read_text())
        record["executed_result"] = state.executed_result.model_dump()
        payload = json.dumps(record, indent=2, default=_serialisable)
        with tempfile.NamedTemporaryFile(
            mode="w", dir=dest.parent, suffix=".tmp", delete=False
        ) as tmp:
            tmp.write(payload)
            tmp_path = tmp.name
        os.replace(tmp_path, dest)
        logger.info("audit: finalised with executed_result %s", dest)
    except Exception:  # noqa: BLE001
        logger.warning("audit: failed to finalize %s", dest, exc_info=True)


def read_audit(state_id: str, tenant_id: str | None = None) -> dict | None:
    """Read audit record by state_id. Searches tenant_id dir if known, else scans all."""
    if tenant_id:
        dest = _AUDIT_ROOT / tenant_id / f"{state_id}.json"
        if dest.exists():
            return json.loads(dest.read_text())
        return None

    # Scan all tenant directories
    for tenant_dir in _AUDIT_ROOT.iterdir():
        if not tenant_dir.is_dir():
            continue
        dest = tenant_dir / f"{state_id}.json"
        if dest.exists():
            return json.loads(dest.read_text())

    return None
