# ArkOps Platform Architecture

Multi-tenant voice agent intake + human approval platform.

---

## 1. Supabase Schema

```sql
-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── tenants ──────────────────────────────────────────────────────────────────
create table tenants (
  id            uuid primary key default uuid_generate_v4(),
  clerk_org_id  text unique not null,          -- Clerk Organization ID (org_xxx)
  name          text not null,
  slug          text unique not null,           -- URL-safe: apex-field-services
  vertical      text not null,                  -- hvac | housing | medical | legal
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tenants_slug_idx on tenants(slug);
create index tenants_clerk_org_idx on tenants(clerk_org_id);

-- ── tenant_configs ────────────────────────────────────────────────────────────
create table tenant_configs (
  id                      uuid primary key default uuid_generate_v4(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  system_prompt           text,                  -- full AI persona/instructions
  intake_questions        jsonb not null default '[]',
  -- [{"id":"q1","label":"What is the issue?","required":true}]
  classification_categories jsonb not null default '[]',
  -- [{"key":"urgent","label":"Urgent","sla_minutes":60}]
  voice_settings          jsonb not null default '{"voice":"nova","language":"en-US"}',
  business_hours          jsonb,
  -- {"timezone":"America/New_York","open":"08:00","close":"18:00","days":[1,2,3,4,5]}
  after_hours_message     text,
  max_intake_turns        int not null default 6,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(tenant_id)
);

-- ── calls ─────────────────────────────────────────────────────────────────────
create table calls (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id),
  state_id      text unique,                    -- FastAPI session ID (matches PipelineState.id)
  status        text not null default 'active', -- active | complete | error | abandoned
  category      text,                           -- classify output: urgent | routine | escalate
  classify_reason text,
  parsed        jsonb,                          -- ParsedRequest fields
  draft         jsonb,                          -- DraftResponse fields
  evaluation    jsonb,                          -- EvaluationResult fields
  caller_id     text,                           -- optional caller identifier
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  duration_seconds int
);
create index calls_tenant_id_idx on calls(tenant_id);
create index calls_state_id_idx on calls(state_id);
create index calls_status_idx on calls(tenant_id, status, created_at desc);

-- ── call_turns ────────────────────────────────────────────────────────────────
create table call_turns (
  id          uuid primary key default uuid_generate_v4(),
  call_id     uuid not null references calls(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  text        text not null,
  created_at  timestamptz not null default now()
);
create index call_turns_call_id_idx on call_turns(call_id, created_at);

-- ── approvals ─────────────────────────────────────────────────────────────────
create table approvals (
  id               uuid primary key default uuid_generate_v4(),
  call_id          uuid not null references calls(id) on delete cascade,
  dispatcher_id    text not null,              -- Clerk user ID (user_xxx)
  status           text not null check (status in ('approved','rejected','edited')),
  reviewer_note    text,
  edited_body      text,
  edited_action_items jsonb,
  decided_at       timestamptz not null default now(),
  unique(call_id)                              -- one approval decision per call
);
create index approvals_call_id_idx on approvals(call_id);
create index approvals_dispatcher_idx on approvals(dispatcher_id);

-- ── audit_log ─────────────────────────────────────────────────────────────────
create table audit_log (
  id          uuid primary key default uuid_generate_v4(),
  call_id     uuid references calls(id),
  tenant_id   uuid not null references tenants(id),
  event_type  text not null,                  -- call_started | turn_completed | pipeline_stage | approved | executed
  payload     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_call_idx on audit_log(call_id, created_at);
create index audit_log_tenant_idx on audit_log(tenant_id, created_at desc);

-- ── integrations ──────────────────────────────────────────────────────────────
create table integrations (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  type        text not null check (type in ('airtable','servicetitan','jobber','email','webhook','slack')),
  label       text not null,
  config      jsonb not null,                 -- encrypted at app layer before write
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index integrations_tenant_idx on integrations(tenant_id, is_active);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Policy pattern: Clerk org membership is verified at FastAPI layer.
-- Supabase RLS uses a session variable set by the backend before each query.

alter table tenants enable row level security;
alter table tenant_configs enable row level security;
alter table calls enable row level security;
alter table call_turns enable row level security;
alter table approvals enable row level security;
alter table audit_log enable row level security;
alter table integrations enable row level security;

-- Backend sets: SET LOCAL app.current_tenant_id = '<uuid>';
create policy "tenant_isolation" on calls
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);

create policy "tenant_isolation" on call_turns
  using (call_id in (
    select id from calls
    where tenant_id = current_setting('app.current_tenant_id')::uuid
  ));

create policy "tenant_isolation" on approvals
  using (call_id in (
    select id from calls
    where tenant_id = current_setting('app.current_tenant_id')::uuid
  ));

create policy "tenant_isolation" on audit_log
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);

create policy "tenant_isolation" on integrations
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);

create policy "tenant_isolation" on tenant_configs
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Platform admin bypass (role set by Clerk metadata)
create policy "platform_admin_bypass" on tenants
  using (current_setting('app.is_platform_admin', true) = 'true');
```

---

## 2. API Surface

All authenticated endpoints verify Clerk JWT. The `X-Org-Id` header carries the Clerk org ID for tenant scoping. Backend resolves `tenant_id` from `clerk_org_id` on every request and sets `app.current_tenant_id` for RLS.

### WebSocket

| Endpoint | Auth | Description |
|---|---|---|
| `WS /ws/intake/{tenant_slug}` | None (anon caller) | Multi-turn voice intake for a tenant. `tenant_slug` scopes the session. |
| `WS /ws/intake/{tenant_slug}?preview=1` | Clerk dispatcher JWT | Preview mode: dispatcher tests their own intake flow. |

### Calls

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/calls` | Dispatcher | Paginated call list for org. Query: `status`, `since`, `limit`, `cursor`. |
| `GET` | `/calls/{call_id}` | Dispatcher | Full call detail: turns, parsed, draft, evaluation, approval. |
| `POST` | `/calls/{call_id}/approve` | Dispatcher | Submit approval decision. Body: `{status, reviewer_note, edited_body, edited_action_items}`. |
| `GET` | `/calls/{call_id}/audit` | Dispatcher | Audit log for a call. |
| `GET` | `/calls/stats` | Dispatcher | Aggregate stats: call volume, avg duration, category breakdown. |

### Tenant Config (Org Admin)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/config` | Org Admin | Get current tenant config. |
| `PUT` | `/config` | Org Admin | Update intake questions, categories, voice, hours, prompt. |
| `GET` | `/config/preview` | Org Admin | Returns rendered system prompt for current config. |

### Integrations

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/integrations` | Org Admin | List integrations for tenant. |
| `POST` | `/integrations` | Org Admin | Create integration. Validates credentials before saving. |
| `PUT` | `/integrations/{id}` | Org Admin | Update integration config. |
| `DELETE` | `/integrations/{id}` | Org Admin | Remove integration. |
| `POST` | `/integrations/{id}/test` | Org Admin | Test integration connectivity. |
| `POST` | `/webhooks/inbound/{tenant_slug}` | HMAC signature | Inbound webhook (e.g. ServiceTitan callback). |

### Platform Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/tenants` | Platform Admin | All tenants + status. |
| `POST` | `/admin/tenants` | Platform Admin | Provision new tenant (creates DB row + Clerk org). |
| `PUT` | `/admin/tenants/{id}` | Platform Admin | Update tenant status, vertical, etc. |
| `GET` | `/admin/stats` | Platform Admin | Platform-wide call volume, revenue, error rates. |

### Utility

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/tts` | None | TTS proxy to Azure. Body: `{text, voice}`. Returns MP3. |
| `GET` | `/health` | None | Liveness probe. |
| `GET` | `/tenant/{slug}` | None | Public tenant info: name, vertical, is_active. Used by intake page to render branding. |

---

## 3. Data Flow (ASCII)

```
CALLER (browser)
  │
  │  GET /tenant/{slug}  →  branding, vertical
  │  WS /ws/intake/{slug}
  │
  ▼
FASTAPI BACKEND
  │
  ├─ Resolves tenant from slug → loads TenantConfig from Supabase
  ├─ Opens AssemblyAI v3 StreamingClient (ConversationSession)
  │    └─ universal-3-5-pro, min_latency, agent_context per turn
  │
  ├─ Multi-turn conversation loop:
  │    User speaks → AssemblyAI TurnEvent → LLM (gpt-5-mini) → response text
  │    └─ WS push → frontend → POST /tts → Azure TTS → audio plays
  │
  ├─ ConversationAgent.is_complete → builds transcript
  │
  └─ LangGraph Pipeline:
       Parse+Classify → Research → Draft → Evaluate
            │
            │  stage_update WS events → frontend live progress
            ▼
       APPROVE GATE (blocks until human decision)
            │
            │  approval_required WS event → DISPATCHER DASHBOARD
            │
            │  Dispatcher reviews: transcript, parsed, draft, evaluation
            │  POST /calls/{id}/approve  →  FastAPI sets approve_stage decision
            │
            ▼
       EXECUTE (if approved)
            │
            └─ IntegrationPlugin.execute(result, config)
                 ├─ AirtablePlugin  → creates record
                 ├─ ServiceTitanPlugin → creates job
                 ├─ EmailPlugin → sends notification
                 └─ WebhookPlugin → POST to tenant endpoint

SUPABASE
  ├─ Writes: call created, turns appended, pipeline stages, approval, audit events
  ├─ Real-time: broadcasts to dispatcher dashboard on new call / stage updates
  └─ RLS: all queries scoped to app.current_tenant_id
```

---

## 4. Multi-tenancy Isolation Model

### Caller session scoping
The WS URL `/ws/intake/{tenant_slug}` is the only input. FastAPI:
1. Queries `tenants` by slug → gets `tenant_id` and `clerk_org_id`
2. Loads `tenant_configs` for that `tenant_id`
3. Creates a `calls` row with `tenant_id`
4. Sets `app.current_tenant_id` for every Supabase query in this session
5. Never exposes `tenant_id` to the caller — only `state_id` (UUID)

### Dispatcher auth flow
1. Dispatcher visits `/dashboard` → Clerk middleware checks JWT
2. Frontend calls FastAPI with `Authorization: Bearer <clerk_jwt>` + `X-Org-Id: org_xxx`
3. FastAPI middleware:
   - Verifies JWT with Clerk's JWKS endpoint (cached, rotated automatically)
   - Extracts `org_id` from JWT's `org_id` claim (set when user switches active org in Clerk)
   - Resolves `tenant_id = SELECT id FROM tenants WHERE clerk_org_id = $1`
   - Sets `app.current_tenant_id` for RLS
   - Checks org membership role (`org:admin` or `org:dispatcher`) from JWT `org_role` claim
4. All DB queries automatically scoped — no manual WHERE tenant_id checks needed

### Cross-tenant leakage prevention
- RLS is the last line of defence (enforced at DB layer regardless of app bugs)
- `state_id` (FastAPI session) is a UUIDv4 — unguessable, not sequential
- WS sessions store `tenant_id` in server-side memory only — never sent to client
- TTS endpoint is stateless, no tenant context needed
- Supabase service role key only used by backend (never exposed to frontend)

---

## 5. Real-time Updates

**Chosen: Supabase real-time subscriptions from the dispatcher frontend.**

Justification:
- Supabase real-time uses PostgreSQL logical replication — new `calls` rows and `calls.status` updates broadcast automatically
- No additional infrastructure needed
- Frontend (Next.js) subscribes directly using `@supabase/supabase-js`
- Backend only writes to DB; real-time delivery is DB → Supabase → frontend (no backend WS needed for the dashboard)
- The intake WS is separate (caller ↔ backend only); once intake completes, backend writes call row → Supabase broadcasts → dispatcher dashboard shows new call

```typescript
// Dispatcher dashboard subscription
const channel = supabase
  .channel('calls')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'calls',
    filter: `tenant_id=eq.${tenantId}`,
  }, (payload) => addCallToQueue(payload.new))
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'calls',
    filter: `tenant_id=eq.${tenantId}`,
  }, (payload) => updateCallInQueue(payload.new))
  .subscribe()
```

---

## 6. Execution Integration Plugin Interface

```python
# backend/integrations/base.py
from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel

class IntegrationResult(BaseModel):
    success: bool
    external_id: str | None = None   # e.g. Airtable record ID
    url: str | None = None            # link to created record
    message: str = ""

class IntegrationPlugin(ABC):
    """One plugin class per integration type. Registered by string key."""

    @abstractmethod
    async def validate_config(self, config: dict[str, Any]) -> bool:
        """Test that credentials are valid before saving. Raise ValueError with message on failure."""

    @abstractmethod
    async def execute(
        self,
        call_id: str,
        parsed: dict,
        draft: dict,
        approval: dict,
        config: dict[str, Any],
    ) -> IntegrationResult:
        """Write the approved work order to the external system."""

# Registry
_PLUGINS: dict[str, type[IntegrationPlugin]] = {}

def register(key: str):
    def decorator(cls):
        _PLUGINS[key] = cls
        return cls
    return decorator

def get_plugin(type_key: str) -> IntegrationPlugin:
    cls = _PLUGINS.get(type_key)
    if not cls:
        raise ValueError(f"Unknown integration type: {type_key}")
    return cls()

# backend/integrations/airtable.py
@register("airtable")
class AirtablePlugin(IntegrationPlugin):
    async def validate_config(self, config):
        # config: {"api_key": "...", "base_id": "...", "table_name": "..."}
        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"https://api.airtable.com/v0/{config['base_id']}/{config['table_name']}",
                headers={"Authorization": f"Bearer {config['api_key']}"},
                params={"maxRecords": 1},
            )
        return r.status_code == 200

    async def execute(self, call_id, parsed, draft, approval, config):
        fields = {
            "Call ID": call_id,
            "Summary": draft.get("body", ""),
            "Action Items": "\n".join(draft.get("action_items", [])),
            "Category": parsed.get("urgency", ""),
            "Address": parsed.get("entities", {}).get("location", ""),
            "Equipment": parsed.get("entities", {}).get("equipment", ""),
            "Reviewer Note": approval.get("reviewer_note", ""),
            "Status": "Dispatched",
        }
        async with httpx.AsyncClient() as c:
            r = await c.post(
                f"https://api.airtable.com/v0/{config['base_id']}/{config['table_name']}",
                headers={"Authorization": f"Bearer {config['api_key']}"},
                json={"fields": fields},
            )
        r.raise_for_status()
        data = r.json()
        return IntegrationResult(
            success=True,
            external_id=data["id"],
            url=f"https://airtable.com/{config['base_id']}/{config['table_name']}/{data['id']}",
        )
```

---

## Key TypeScript Types

```typescript
// frontend/lib/types.ts additions

export interface Tenant {
  id: string
  clerk_org_id: string
  name: string
  slug: string
  vertical: 'hvac' | 'housing' | 'medical' | 'legal' | 'generic'
  is_active: boolean
}

export interface TenantConfig {
  system_prompt: string
  intake_questions: IntakeQuestion[]
  classification_categories: ClassificationCategory[]
  voice_settings: VoiceSettings
  business_hours: BusinessHours | null
  after_hours_message: string | null
  max_intake_turns: number
}

export interface IntakeQuestion {
  id: string
  label: string
  required: boolean
  hint?: string
}

export interface ClassificationCategory {
  key: string
  label: string
  sla_minutes: number
  color: string  // for UI badge
  auto_approve?: boolean
}

export interface VoiceSettings {
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  language: string
}

export interface BusinessHours {
  timezone: string
  open: string   // "08:00"
  close: string  // "18:00"
  days: number[] // 0=Sun, 1=Mon … 6=Sat
}

export interface Call {
  id: string
  tenant_id: string
  state_id: string
  status: 'active' | 'complete' | 'error' | 'abandoned'
  category: string | null
  classify_reason: string | null
  parsed: Record<string, unknown> | null
  draft: Record<string, unknown> | null
  evaluation: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

export interface Approval {
  id: string
  call_id: string
  dispatcher_id: string
  status: 'approved' | 'rejected' | 'edited'
  reviewer_note: string | null
  edited_body: string | null
  decided_at: string
}

export interface Integration {
  id: string
  tenant_id: string
  type: 'airtable' | 'servicetitan' | 'jobber' | 'email' | 'webhook' | 'slack'
  label: string
  is_active: boolean
}
```

---

## Seed Data (3 Demo Tenants)

```sql
insert into tenants (clerk_org_id, name, slug, vertical) values
  ('org_demo_hvac',    'Apex Field Services',      'apex-field-services', 'hvac'),
  ('org_demo_housing', 'CityView Housing',          'cityview-housing',    'housing'),
  ('org_demo_medical', 'Northside Medical Office',  'northside-medical',   'medical');

insert into tenant_configs (tenant_id, system_prompt, intake_questions, classification_categories, max_intake_turns)
select id,
  'You are a professional intake agent for an HVAC service company...',
  '[{"id":"q1","label":"What equipment is having issues?","required":true},{"id":"q2","label":"Where is the unit located?","required":true}]',
  '[{"key":"urgent","label":"Urgent","sla_minutes":120,"color":"#DC2626"},{"key":"routine","label":"Routine","sla_minutes":1440,"color":"#2563EB"}]',
  6
from tenants where slug = 'apex-field-services';

-- similar rows for housing and medical
```
