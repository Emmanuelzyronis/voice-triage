# ArkOps — Demo Script

**Target duration: 3 minutes**
**Format:** Screen recording with voiceover. Browser + terminal side by side.
**Demo tenant:** Apex Field Services (HVAC / plumbing / field operations)

The demo shows the engine. The pitch explains the platform.
Hook judges with the working product, close with the expansion vision.

---

## Setup before recording

- Demo tenant seeded: Apex Field Services knowledge base (FAQ, dispatch policies, team directory)
- Browser open at `localhost:3000`
- Terminal visible — backend logs filtered to stage transitions only (no noise)
- Three browser tabs ready: main UI, audit JSON viewer, tenant config YAML
- Mic tested, quiet room, no background noise
- Run one full test pass before recording — confirm all 8 stages complete

---

## Script

### 0:00–0:20 — Hook (voiceover only)

> "Most voice AI products make one of two mistakes. Either they just transcribe and
> stop — the human still does all the work. Or they act autonomously — no accountability
> when they're wrong. ArkOps takes the middle position: the AI does the thinking, the
> human makes the decision, the system enforces the rule. Let me show you."

No action on screen yet. Title card: **ArkOps** — *AI that turns operational conversations into approved work.*

---

### 0:20–0:50 — Live transcript (AssemblyAI)

**Action:** Click the mic button. Speak clearly and at a normal pace:

> "Hi, this is Marcus from building 4B. Our HVAC unit stopped working completely —
> it's been out since yesterday and it's 91 degrees in here. I need an emergency
> technician today or first thing Thursday at the latest."

**What to show:**
- Words appearing word-by-word in the LiveTranscript panel as you speak
- Pause at the end — show the final punctuated transcript appear
- Stage indicator animates: **LISTEN** ✓ → **PARSE** (spinning)

**Voiceover:**
> "AssemblyAI's real-time streaming STT picks up every word as it's spoken.
> When the caller stops, it delivers the final punctuated transcript and
> the pipeline starts automatically."

---

### 0:50–1:20 — Pipeline stages

**Action:** No interaction — pipeline runs. Let stages animate through.

**What to show:**
- **PARSE** completes → zoom in briefly:
  - Intent: "Emergency HVAC repair request, building 4B"
  - Urgency: HIGH
  - Observed: ["HVAC unit non-functional since yesterday", "temperature 91°F", "caller in building 4B"]
  - Unknown: ["exact unit model", "lease agreement status", "preferred technician"]
- **CLASSIFY** → `ACTION_REQUIRED — "Emergency service request with named location and urgency"`
- **RESEARCH** → pulled 3 context chunks: dispatch policy, emergency escalation rules, service area map
- **DRAFT** → animates complete
- **EVALUATE** → animates complete

**Voiceover:**
> "Parse extracts intent, urgency, and — importantly — what the system knows for certain
> versus what it's inferring. Classify routes it: this is action required, not just a question.
> Research pulls the relevant context from Apex's knowledge base — dispatch policies,
> service area, escalation rules. Draft produces structured output: not a paragraph, but
> named slots. And before the human sees anything, the pipeline evaluates its own draft."

---

### 1:20–1:45 — Evaluation verdict

**Action:** Zoom in on the Evaluation panel.

**What to show:**
```
✓ Intent addressed       PASS — "Work order drafted matching caller's request"
✓ Factually grounded     PASS — "All action items cite retrieved dispatch policy"
✓ Tone appropriate       PASS — "Urgency level reflected in draft"
  Issues found:          None
  Overall:               PASS
```

**Voiceover:**
> "The evaluator is prompted adversarially — it's asked to find three reasons
> the draft might be wrong before it assesses each criterion. Only when it passes
> does the approval gate open. The human doesn't see unreviewed output."

---

### 1:45–2:20 — Approval gate

**Action:** Show the full approval UI. Pan slowly across all three panels.

**What to show:**

Panel 1 (left) — **Original Transcript:**
```
"Hi, this is Marcus from building 4B. Our HVAC unit stopped working completely —
it's been out since yesterday and it's 91 degrees in here. I need an emergency
technician today or first thing Thursday at the latest."
Session: aai_8d2f91 · AssemblyAI confidence: 0.96
```

Panel 2 (centre) — **Evaluation Verdict:**
```
✓ Intent addressed   ✓ Factually grounded   ✓ Tone appropriate
Issues: None · Overall: PASS
```

Panel 3 (right) — **Draft:**
```
Body: Emergency HVAC repair request for unit in Building 4B.
      Caller reports complete failure since yesterday. Temp: 91°F. HIGH urgency.

Action items:
  · Create emergency work order — Building 4B HVAC unit
  · Assign available technician for today or Thursday AM
  · Notify building manager of service window

Caveats:
  · Unit model unknown — technician should inspect on arrival
  · Thursday availability not confirmed with dispatch
```

**Voiceover:**
> "The approval gate shows everything at once — the caller's exact words, the
> evaluation verdict, and the draft side by side. The dispatcher can approve it
> as-is, edit the draft before approving, or reject with a reason. There is no
> button that bypasses this. The pipeline doesn't have a path to Execute without
> an Approved state."

---

### 2:20–2:40 — Approve + Audit trail

**Action:** Click APPROVE. Then switch to the audit tab.

**What to show:**
- EXECUTING state → COMPLETE ✓
- Switch to terminal: `cat audit/demo-fieldops/{state_id}.json` — show the full record briefly
  (don't read it — just show it exists and is structured)

**Voiceover:**
> "Approved. The work order is queued. The audit trail is written before execution —
> every decision in that run: the caller's words, what was retrieved, the evaluation
> verdict, who approved it and when. If anything is ever disputed, the record is there."

---

### 2:40–2:55 — Tenant config (15 seconds)

**Action:** Switch to the third tab — `tenant_demo.yaml`

**What to show:**
```yaml
tenant_id: demo-fieldops
name: Apex Field Services
ai_instructions: |
  This is a field operations company handling HVAC, plumbing, and electrical.
  Callers report equipment failures, request service visits, or ask about scheduling.
approval_rules:
  action_required: human_required
  escalate: human_required
  info_request: auto_approve
  defer: auto_approve
integrations:
  - webhook
```

**Voiceover:**
> "This is Apex Field Services — one tenant config. The same engine, a different YAML,
> serves a property management company, an insurance intake team, or a legal practice.
> The pipeline is shared. The vertical is configuration."

---

### 2:55–3:00 — Close

**Voiceover:**
> "ArkOps. AI that turns operational conversations into approved work.
> AssemblyAI for the voice layer. Human approval enforced in code, not convention.
> And a multi-tenant engine that scales across every industry that runs on inbound calls."

**What to show:**
- GitHub repo: `github.com/Emmanuelzyronis/voice-triage`
- Title card: **ArkOps** — phase 0 of the platform

---

## Recording notes

- Terminal font: 18pt minimum — readable at 1080p
- Keep pipeline stage animations on screen long enough to read the stage name
- The approval gate scene (1:45–2:20) is the most important — spend time on all three panels
- The tenant config reveal (2:40–2:55) is the expansion argument — don't rush it
- No background music — this is a voice agent demo, silence is correct
- Export at 1080p, target 3:00, hard cap 3:30
- Upload unlisted to YouTube before Sep 29, have the URL ready

---

## Fallback (if pipeline isn't fully wired by Day 6)

If the live mic-to-browser flow isn't working:
1. Pre-record the terminal output (python test_mic with a saved audio file)
2. Show the approval UI with a pre-loaded state (hardcoded JSON)
3. Demo the approval → execute → audit trail flow manually

The approval gate and audit trail are the differentiator — those must be shown,
even if the live STT isn't wired to the browser yet.
