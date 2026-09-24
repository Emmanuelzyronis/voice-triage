'use client'

import { useState } from 'react'
import type {
  AppPhase,
  ApprovalPayload,
  EvaluationVerdict,
  DraftSlots,
  ParsedIntent,
} from '@/lib/types'
import type { ApprovalDecision } from '@/hooks/usePipeline'

interface ApprovalGateProps {
  approval: ApprovalPayload
  phase: AppPhase
  onDecide: (decision: ApprovalDecision) => void
}

function categoryStyle(cat: string): string {
  switch (cat) {
    case 'action_required': return 'bg-blueDim text-blue'
    case 'escalate':        return 'bg-redDim text-red'
    case 'ambiguous':       return 'bg-accentDim text-accent'
    case 'info_request':    return 'bg-surface2 text-muted'
    case 'defer':           return 'bg-surface2 text-dim'
    default:                return 'bg-surface2 text-muted'
  }
}

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function urgencyClass(urgency: string): string {
  switch (urgency) {
    case 'critical': return 'text-red'
    case 'high':     return 'text-accent'
    case 'normal':   return 'text-muted'
    case 'low':      return 'text-dim'
    default:         return 'text-muted'
  }
}

function PanelHeader({ label }: { label: string }) {
  return (
    <div className="text-xs font-mono text-dim uppercase tracking-widest pb-2 mb-4 border-b border-border">
      {label}
    </div>
  )
}

function ContextPanel({ approval }: { approval: ApprovalPayload }) {
  const parsed: ParsedIntent | null = approval.parsed

  return (
    <div className="bg-surface rounded-lg p-4 flex flex-col gap-4">
      <PanelHeader label="Context" />

      {/* Transcript */}
      <p className="text-text text-sm leading-relaxed font-sans italic">
        &ldquo;{approval.parsed?.raw_text ?? '—'}&rdquo;
      </p>

      {/* Category badge + reason */}
      <div className="flex flex-col gap-2">
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full self-start ${categoryStyle(approval.category)}`}>
          {categoryLabel(approval.category)}
        </span>
        {approval.classify_reason && (
          <p className="text-muted text-sm">{approval.classify_reason}</p>
        )}
      </div>

      {/* Urgency */}
      {parsed?.urgency && (
        <div className="flex items-center gap-2">
          <span className="text-dim text-xs font-mono">Urgency</span>
          <span className={`text-xs font-mono font-semibold ${urgencyClass(parsed.urgency)}`}>
            {parsed.urgency.toUpperCase()}
          </span>
        </div>
      )}

      {parsed === null && (
        <p className="text-dim text-xs italic">
          Full analysis not available — route bypassed evaluation.
        </p>
      )}

      {/* Unknown items */}
      {parsed && parsed.evidence.unknown.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-dim text-xs font-mono">Open questions</span>
          <ul className="flex flex-col gap-1">
            {parsed.evidence.unknown.map((item, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-accent mt-0.5 shrink-0">⚠</span>
                <span className="text-muted text-xs leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function EvaluationPanel({ evaluation }: { evaluation: EvaluationVerdict | null }) {
  if (!evaluation) {
    return (
      <div className="bg-surface rounded-lg p-4 flex flex-col gap-4">
        <PanelHeader label="Evaluation" />
        <p className="text-muted text-sm">
          This request was routed directly to review — no automated evaluation ran.
        </p>
      </div>
    )
  }

  const verdictBanner: Record<string, string> = {
    PASS:       'bg-greenDim text-green border-green',
    NEEDS_EDIT: 'bg-accentDim text-accent border-accent',
    FAIL:       'bg-redDim text-red border-red',
  }

  const verdictLabel: Record<string, string> = {
    PASS:       'Evaluation: PASS',
    NEEDS_EDIT: '⚠ Needs Edit — review issues below',
    FAIL:       '✕ Evaluation: FAIL — redraft recommended',
  }

  const criteria: { key: keyof EvaluationVerdict; label: string }[] = [
    { key: 'addresses_intent',   label: 'Addresses intent' },
    { key: 'factually_grounded', label: 'Factually grounded' },
    { key: 'tone_appropriate',   label: 'Appropriate tone' },
  ]

  return (
    <div className="bg-surface rounded-lg p-4 flex flex-col gap-4">
      <PanelHeader label="Evaluation" />

      {/* Overall verdict */}
      <div className={`text-sm font-mono px-4 py-2 rounded border ${verdictBanner[evaluation.overall] ?? 'bg-surface2 text-muted border-border'}`}>
        {verdictLabel[evaluation.overall] ?? evaluation.overall}
      </div>

      {/* Per-criterion rows */}
      <div className="flex flex-col gap-2">
        {criteria.map(({ key, label }) => {
          const passed = evaluation[key] as boolean
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-muted text-xs">{label}</span>
              <span className={`text-xs font-mono ${passed ? 'text-green' : 'text-red'}`}>
                {passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Issues found */}
      {evaluation.issues_found.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-dim text-xs font-mono">Adversarial findings</span>
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {evaluation.issues_found.map((issue, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-accent shrink-0 mt-0.5">›</span>
                <span className="text-muted text-xs leading-relaxed">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface DraftPanelProps {
  draft: DraftSlots | null
  editMode: boolean
  editBody: string
  onEditBodyChange: (v: string) => void
}

function DraftPanel({ draft, editMode, editBody, onEditBodyChange }: DraftPanelProps) {
  return (
    <div className="bg-surface rounded-lg p-4 flex flex-col gap-4">
      <PanelHeader label="Draft" />

      {!draft ? (
        <p className="text-muted text-sm">No draft generated for this route.</p>
      ) : (
        <>
          {/* Body */}
          {editMode ? (
            <textarea
              value={editBody}
              onChange={e => onEditBodyChange(e.target.value)}
              rows={6}
              className="bg-surface2 border border-borderStrong text-text rounded p-3 w-full text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label="Edit draft body"
            />
          ) : (
            <p className="text-text text-sm leading-relaxed">{draft.body}</p>
          )}

          {/* Action items */}
          {draft.action_items.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-dim text-xs font-mono">Actions</span>
              <ol className="flex flex-col gap-1">
                {draft.action_items.map((item, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-green font-mono text-xs shrink-0 mt-0.5">→</span>
                    <span className="text-text text-sm font-mono">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Caveats */}
          {draft.caveats.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-dim text-xs font-mono">Caveats</span>
              <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                {draft.caveats.map((c, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-accent shrink-0 text-xs mt-0.5">⚠</span>
                    <span className="text-accent text-xs leading-snug">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function ApprovalGate({ approval, phase, onDecide }: ApprovalGateProps) {
  const [editMode, setEditMode] = useState(false)
  const [editBody, setEditBody] = useState(approval.draft?.body ?? '')
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  const isExecuting = phase === 'executing'

  function handleApprove() {
    if (isExecuting) return
    onDecide({ status: 'approved' })
  }

  function handleConfirmEdit() {
    if (!editBody.trim()) return
    onDecide({ status: 'edited', edited_body: editBody })
  }

  function handleReject() {
    if (!rejectNote.trim()) return
    onDecide({ status: 'rejected', reviewer_note: rejectNote })
  }

  return (
    <div className="animate-entrance flex flex-col gap-4 w-full">
      {/* Three panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ContextPanel approval={approval} />
        <EvaluationPanel evaluation={approval.evaluation} />
        <DraftPanel
          draft={approval.draft}
          editMode={editMode}
          editBody={editBody}
          onEditBodyChange={setEditBody}
        />
      </div>

      {/* Edit confirm row */}
      {editMode && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setEditMode(false)}
            className="px-4 py-2 text-sm font-mono text-muted border border-border rounded hover:border-borderStrong hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmEdit}
            disabled={!editBody.trim()}
            className="px-4 py-2 text-sm font-mono text-bg bg-accent rounded hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
            aria-label="Confirm edited draft and approve"
          >
            Confirm &amp; Approve
          </button>
        </div>
      )}

      {/* Reject note input */}
      {rejectMode && !editMode && (
        <div className="flex gap-3 items-start bg-surface rounded-lg p-4 border border-redDim">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-dim text-xs font-mono" htmlFor="reject-note">
              Rejection reason (required)
            </label>
            <input
              id="reject-note"
              type="text"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. wrong customer, insufficient detail…"
              className="bg-surface2 border border-borderStrong text-text rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red w-full"
              onKeyDown={e => e.key === 'Enter' && rejectNote.trim() && handleReject()}
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-6">
            <button
              onClick={() => setRejectMode(false)}
              className="px-3 py-2 text-sm font-mono text-muted border border-border rounded hover:border-borderStrong hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectNote.trim()}
              className="px-3 py-2 text-sm font-mono text-white bg-red rounded hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Confirm rejection with note"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Main action buttons */}
      {!editMode && !rejectMode && (
        <div className="flex gap-3 justify-end">
          {isExecuting ? (
            <div className="flex items-center gap-2 text-muted text-sm font-mono">
              <Spinner />
              Submitting…
            </div>
          ) : (
            <>
              <button
                onClick={() => setRejectMode(true)}
                disabled={isExecuting}
                aria-label="Reject this draft"
                className="px-4 py-2 text-sm font-mono text-red border border-redDim rounded hover:bg-redDim disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => { setEditBody(approval.draft?.body ?? ''); setEditMode(true) }}
                disabled={isExecuting || !approval.draft}
                aria-label="Edit draft body before approving"
                className="px-4 py-2 text-sm font-mono text-text border border-borderStrong rounded hover:bg-surface2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Edit + Approve
              </button>
              <button
                onClick={handleApprove}
                disabled={isExecuting}
                aria-label="Approve and execute this draft"
                className="px-5 py-2 text-sm font-mono font-semibold text-bg bg-accent rounded hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Approve
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
