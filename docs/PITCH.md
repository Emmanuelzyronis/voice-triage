# ArkOps — Platform Pitch

**One line:** AI that turns operational conversations into approved work.

---

## The Problem

Every business that runs on inbound calls has the same broken loop:

1. Customer calls
2. Staff member takes notes (or doesn't)
3. Staff member manually creates a ticket / work order / record
4. Someone approves it (or it goes straight to execution and something goes wrong)
5. No audit trail

The bottleneck is the middle — the translation from spoken words to structured action.
It's manual, inconsistent, error-prone, and undocumented.

Voice AI has been marketed as the solution for a decade. The actual products shipped so far:
- **Transcription tools** — still leaves humans to do the work
- **Voice chatbots** — don't remember context, don't take actions, not trusted for anything consequential
- **Autonomous voice agents** — act without human oversight, wrong when it matters most

None of them solve the real problem: **turning a conversation into a correct, approved, auditable action.**

---

## The Engine

ArkOps is an 8-stage pipeline where voice is the input and a human-approved action is the output.

```
Call / voicemail → Transcription → Extract intent → Draft action
→ Surface unknowns → Human approval → Execute into tenant's system
```

Three things make it different from every other voice AI product:

**1. Evidence taxonomy — observed / inferred / unknown**
Every extracted fact is labelled. Observed = directly stated. Inferred = reasonable interpretation,
explicitly marked as such. Unknown = gaps — never collapsed into a guess. The human reviewer
sees what the AI knows, what it's interpreting, and what it cannot determine.

**2. Adversarial self-review**
Before the human sees anything, the pipeline evaluates its own draft. The prompt is adversarial —
it is asked to find three reasons the draft might be wrong before it makes a final assessment.
Structured verdict, per criterion. Not "is this good?" — "where might this be wrong?"

**3. Approval gate, enforced in code**
The pipeline graph has no path from Draft to Execute without an `APPROVED` state on the
`PipelineState` object. This is not a UI convention. It is not a flag checked at runtime.
It is the graph topology. Nothing executes without a human decision.

---

## Multi-Tenant Platform

The engine is shared. Everything vertical-specific is configuration.

Each tenant gets:
- Their own phone numbers / inbound channels
- Their own users and roles (dispatcher, manager, admin)
- Their own AI instructions (domain vocabulary, terminology)
- Their own approval rules (what requires human sign-off, what auto-approves)
- Their own integrations (webhook, email, CRM, ticketing)
- Their own knowledge base (ChromaDB, namespaced)
- Their own audit history

The same engine serves:

| Field operations | Work order → dispatcher approves → assigned |
| Property management | Maintenance ticket → landlord approves → contractor notified |
| Insurance intake | Claim record → adjuster approves → filed |
| Legal intake | Matter summary → lawyer approves → filed |
| Healthcare admin | Triage notes → nurse approves → records updated |
| Logistics | Exception → ops approves → re-routed |

The vertical-specific part is a YAML config file. The pipeline, approval gate, and audit trail
are identical across all of them.

---

## Expansion Path

**Phase 0 (Now):** Engine proven. Single demo tenant. AssemblyAI hackathon.

**Phase 1:** Single paying customer. Phone provisioning (Twilio). Persistent audit DB.
Webhook integration. Hosted approval UI. Usage-based pricing.

**Phase 2:** Multi-tenant. PostgreSQL RLS. Per-tenant isolation. Self-serve onboarding.
Metered billing (Stripe). Starter / Pro / Business tiers.

**Phase 3:** Workflow builder. Visual approval chains. Conditional rules. Integration library
(Calendar, Salesforce, HubSpot, Linear, PagerDuty). Multi-channel input (SMS, email, web form).

**Phase 4:** Enterprise. Dedicated infra per tenant. SAML/SSO. Compliance export.
Healthcare and legal verticals. White-label.

---

## Pricing Model

Usage-based + seat fee. Metered on minutes processed, calls handled, workflow runs executed.

| Plan | Price | Limits |
|---|---|---|
| Starter | $49/mo | 1 location · 1 user · 100 calls |
| Pro | $199/mo | 3 locations · 5 users · 500 calls · integrations |
| Business | $599/mo | Unlimited locations · 20 users · 2,000 calls |
| Enterprise | Custom | Dedicated infra · SSO · SLA · compliance |

---

## Why This Wins

The approval gate is the product moat.

Every competitor either skips it (autonomous agents) or stops before it (transcription tools).
The businesses that most need voice AI — field ops, property, insurance, legal, healthcare —
are exactly the ones that cannot afford autonomous AI mistakes. They need a human in the loop.
ArkOps is the only product built around that constraint rather than trying to eliminate it.

The evidence taxonomy is the trust mechanism. When a human reviews the draft and can see
exactly what the model knew, what it guessed, and what it didn't know — they can make a
real decision in 10 seconds instead of second-guessing a black box.

Multi-tenancy makes the unit economics work. One pipeline codebase, $49–$599/mo per tenant,
low marginal cost per additional vertical. The infrastructure gets more valuable as more tenants
join, not less.

---

## Built By

Emmanuel Ibiezugbe — Independent Engineer · Correctness First
[emmanuelibiezugbe.com](https://emmanuelibiezugbe.com)

Previous work: LEDGER (254 tests, 42/42 formal proofs), MailFlow AI (6-stage human-gated pipeline),
ArkOne (live CRM), ArkZen (9-stage workflow), FreshIndex, CollabCanvas.

ArkOps is the platform the pipeline work has been pointing toward.
