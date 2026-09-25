-- ArkOps initial schema
-- gen_random_uuid() is built-in on Supabase Postgres 14+

-- ── tenants ──────────────────────────────────────────────────────────────────
create table tenants (
  id            uuid primary key default gen_random_uuid(),
  clerk_org_id  text unique not null,
  name          text not null,
  slug          text unique not null,
  vertical      text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tenants_slug_idx on tenants(slug);
create index tenants_clerk_org_idx on tenants(clerk_org_id);

-- ── tenant_configs ────────────────────────────────────────────────────────────
create table tenant_configs (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  system_prompt             text,
  intake_questions          jsonb not null default '[]',
  classification_categories jsonb not null default '[]',
  voice_settings            jsonb not null default '{"voice":"nova","language":"en-US"}',
  business_hours            jsonb,
  after_hours_message       text,
  max_intake_turns          int not null default 6,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique(tenant_id)
);

-- ── calls ─────────────────────────────────────────────────────────────────────
create table calls (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id),
  state_id         text unique,
  status           text not null default 'active',
  category         text,
  classify_reason  text,
  parsed           jsonb,
  draft            jsonb,
  evaluation       jsonb,
  caller_id        text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz,
  duration_seconds int
);
create index calls_tenant_id_idx on calls(tenant_id);
create index calls_state_id_idx on calls(state_id);
create index calls_status_idx on calls(tenant_id, status, created_at desc);

-- ── call_turns ────────────────────────────────────────────────────────────────
create table call_turns (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid not null references calls(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  text       text not null,
  created_at timestamptz not null default now()
);
create index call_turns_call_id_idx on call_turns(call_id, created_at);

-- ── approvals ─────────────────────────────────────────────────────────────────
create table approvals (
  id                  uuid primary key default gen_random_uuid(),
  call_id             uuid not null references calls(id) on delete cascade,
  dispatcher_id       text not null,
  status              text not null check (status in ('approved','rejected','edited')),
  reviewer_note       text,
  edited_body         text,
  edited_action_items jsonb,
  decided_at          timestamptz not null default now(),
  unique(call_id)
);
create index approvals_call_id_idx on approvals(call_id);
create index approvals_dispatcher_idx on approvals(dispatcher_id);

-- ── audit_log ─────────────────────────────────────────────────────────────────
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid references calls(id),
  tenant_id  uuid not null references tenants(id),
  event_type text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_call_idx on audit_log(call_id, created_at);
create index audit_log_tenant_idx on audit_log(tenant_id, created_at desc);

-- ── integrations ──────────────────────────────────────────────────────────────
create table integrations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  type       text not null check (type in ('airtable','servicetitan','jobber','email','webhook','slack')),
  label      text not null,
  config     jsonb not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integrations_tenant_idx on integrations(tenant_id, is_active);

-- ── Row Level Security ────────────────────────────────────────────────────────
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

create policy "platform_admin_bypass" on tenants
  using (current_setting('app.is_platform_admin', true) = 'true');
