"""Thin async wrapper around the Supabase PostgREST REST API using httpx.

All writes use the service-role key, which bypasses RLS — tenant isolation is
enforced by the backend itself before any write.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0


def _headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def upsert_call(
    url: str,
    service_key: str,
    *,
    state_id: str,
    tenant_id: str,
    status: str,
    category: str | None = None,
    classify_reason: str | None = None,
    parsed: dict | None = None,
    draft: dict | None = None,
    evaluation: dict | None = None,
    caller_snippet: str | None = None,
) -> dict | None:
    """Insert or update a call row keyed on state_id."""
    if not url or not service_key:
        return None
    data: dict[str, Any] = {
        "state_id": state_id,
        "tenant_id": tenant_id,
        "status": status,
    }
    if category is not None:
        data["category"] = category
    if classify_reason is not None:
        data["classify_reason"] = classify_reason
    if parsed is not None:
        data["parsed"] = parsed
    if draft is not None:
        data["draft"] = draft
    if evaluation is not None:
        data["evaluation"] = evaluation
    if caller_snippet is not None:
        data["caller_id"] = caller_snippet

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{url.rstrip('/')}/rest/v1/calls",
                json=data,
                headers={
                    **_headers(service_key),
                    "Prefer": "return=representation,resolution=merge-duplicates",
                    "on_conflict": "state_id",
                },
            )
        if resp.status_code not in (200, 201):
            logger.warning("supabase upsert_call failed", status=resp.status_code, body=resp.text[:200])
            return None
        rows = resp.json()
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("supabase upsert_call error", error=str(exc))
        return None


async def insert_approval(
    url: str,
    service_key: str,
    *,
    call_id: str,
    dispatcher_id: str,
    status: str,
    reviewer_note: str = "",
    edited_body: str | None = None,
    edited_action_items: list | None = None,
) -> dict | None:
    if not url or not service_key:
        return None
    data: dict[str, Any] = {
        "call_id": call_id,
        "dispatcher_id": dispatcher_id,
        "status": status,
        "reviewer_note": reviewer_note,
    }
    if edited_body:
        data["edited_body"] = edited_body
    if edited_action_items:
        data["edited_action_items"] = edited_action_items

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{url.rstrip('/')}/rest/v1/approvals",
                json=data,
                headers=_headers(service_key),
            )
        if resp.status_code not in (200, 201):
            logger.warning("supabase insert_approval failed", status=resp.status_code, body=resp.text[:200])
            return None
        rows = resp.json()
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("supabase insert_approval error", error=str(exc))
        return None


async def list_calls(
    url: str,
    service_key: str,
    *,
    tenant_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Return calls, optionally filtered by tenant and/or status."""
    if not url or not service_key:
        return []
    params: dict[str, str] = {
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if tenant_id:
        params["tenant_id"] = f"eq.{tenant_id}"
    if status:
        params["status"] = f"eq.{status}"

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{url.rstrip('/')}/rest/v1/calls",
                params=params,
                headers=_headers(service_key),
            )
        if resp.status_code != 200:
            logger.warning("supabase list_calls failed", status=resp.status_code)
            return []
        return resp.json()
    except Exception as exc:
        logger.warning("supabase list_calls error", error=str(exc))
        return []


async def get_call_by_state_id(url: str, service_key: str, state_id: str) -> dict | None:
    if not url or not service_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{url.rstrip('/')}/rest/v1/calls",
                params={"state_id": f"eq.{state_id}", "limit": "1"},
                headers=_headers(service_key),
            )
        if resp.status_code != 200:
            return None
        rows = resp.json()
        return rows[0] if rows else None
    except Exception:
        return None
