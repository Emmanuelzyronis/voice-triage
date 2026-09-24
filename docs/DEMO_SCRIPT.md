# VoiceTriage Demo Script

**Target duration: 3 minutes**
**Format:** Screen recording with voiceover. Show the browser + terminal side by side.

---

## Setup before recording
- Knowledge base seeded with: company FAQ, team directory, meeting policies
- Browser open at `localhost:3000`
- Terminal visible showing backend logs (filter to pipeline stage transitions only)
- Mic tested, quiet room

---

## Script

### 0:00–0:20 — Hook (voiceover only, no action yet)

> "Most voice agents are voice chatbots — microphone in, language model out. VoiceTriage is different. It's an 8-stage pipeline where voice is just the input. Every response goes through structured drafting, adversarial self-review, and a human approval gate before anything happens. Nothing is actioned without a human decision. Let me show you."

---

### 0:20–0:45 — Live transcript (AssemblyAI)

**Action:** Click the microphone button. Speak clearly:

> "I need to schedule an urgent meeting with the sales team and the engineering leads for this Thursday to discuss the Q3 product roadmap."

**What to show on screen:**
- Words appearing in real time in the `LiveTranscript` panel as you speak — highlight this
- After you stop: the final punctuated transcript appears
- Stage indicator: LISTEN → PARSE (animates)

**Voiceover:**
> "AssemblyAI's real-time streaming STT picks up the speech and shows it word by word. When I stop talking, it delivers the final punctuated transcript and the pipeline starts."

---

### 0:45–1:10 — Pipeline stages

**Action:** No interaction — pipeline runs automatically.

**What to show on screen:**
- Stage indicators lighting up: PARSE → CLASSIFY → RESEARCH → DRAFT → EVALUATE
- Each stage takes 1–2 seconds — show them animating through
- Zoom in on CLASSIFY showing: `ACTION_REQUIRED — "Scheduling request with named participants and urgency"` 

**Voiceover:**
> "Parse extracts the intent, participants, urgency. Classify routes it: this is an action required, not just a question. Research pulls the relevant context from our knowledge base — meeting room policies, team calendars, the Q3 roadmap brief. Draft produces structured output — not a paragraph, but named slots: summary, action items, each with a source citation."

---

### 1:10–1:40 — Evaluation verdict

**Action:** Let the Evaluate stage complete. Zoom in on the evaluation panel.

**What to show on screen:**
- EvaluateResult panel with per-criterion breakdown:
  - Intent addressed: PASS
  - Factual grounding: PASS — "All action items cite a retrieved context chunk"
  - No overreach: PASS
  - Tone: PASS
- Overall: `PASS`

**Voiceover:**
> "Before the human sees anything, the pipeline evaluates its own draft — adversarially. It's asked to find three reasons the draft might be wrong, then check each criterion. Only then does it reach the human."

---

### 1:40–2:10 — Approval gate

**Action:** Show the approval UI in full. Slowly pan across all three panels.

**What to show on screen:**
- Panel 1: Original transcript
- Panel 2: Evaluation verdict (all PASS, per-criterion)
- Panel 3: Draft — summary, action items (e.g., "Create calendar invite — Thu Oct 1, Sales Team + Eng Leads"), caveats ("Thursday availability not confirmed"), sources cited inline

**Voiceover:**
> "The approval gate shows everything at once — the original words, the evaluation verdict, and the draft side by side. The human can approve it as-is, edit the draft and then approve, or reject with a reason. There is no button that bypasses this. The pipeline graph doesn't have a path to Execute without an Approved state."

---

### 2:10–2:30 — Click approve + audit trail

**Action:** Click APPROVE. Show execute state. Then open the audit trail JSON briefly.

**What to show on screen:**
- EXECUTING state → COMPLETE
- Open `audit/` folder in terminal: `cat latest.json` — show the full record (transcript, parse, classify, research chunks, draft, eval verdict, approval timestamp)

**Voiceover:**
> "Approved — the calendar invite is queued. The audit trail is written before execution: every decision, every retrieved chunk, the evaluation verdict, who approved it and when. If anything is ever questioned, the record is there."

---

### 2:30–2:50 — Rejection case (optional if time allows)

**Action:** Run a second example. Speak something ambiguous:

> "Send that thing we discussed to the team."

**What to show on screen:**
- Classify: `AMBIGUOUS — "Referent 'that thing' cannot be resolved from transcript"`
- Pipeline halts at Approve with a clarification request
- Human sees: "I couldn't determine what to send. Can you be more specific?"

**Voiceover:**
> "When the intent can't be resolved, VoiceTriage surfaces the ambiguity rather than guessing. AMBIGUOUS is a first-class outcome — the human is asked to clarify, not presented with a confident wrong answer."

---

### 2:50–3:00 — Close

**Voiceover:**
> "VoiceTriage. AssemblyAI for the voice layer. LangGraph for the pipeline. Structured output so every stage is auditable. An adversarial self-review so the human sees what matters. And an approval gate that cannot be bypassed. Voice as input to a system that earns trust."

**What to show on screen:**
- GitHub repo: `github.com/Emmanuelzyronis/voice-triage`
- lablab.ai submission link

---

## Recording notes
- Keep terminal font large (18pt minimum) — readable at 1080p
- Pipeline stage animations should be visible — don't rush through them
- The approval gate scene is the most important: spend time showing all three panels
- No background music — voice clarity matters for a voice agent demo
- Export at 1080p minimum, keep under 5 minutes including any intro title card
