'use client'

import type { PipelineCompletePayload } from '@/lib/types'

interface ExecutedPanelProps {
  result: PipelineCompletePayload
  stateId: string
  onReset: () => void
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function CheckIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <circle cx="18" cy="18" r="18" className="fill-greenDim" />
      <path
        d="M10 18l6 6 10-12"
        stroke="#10B981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <circle cx="18" cy="18" r="18" className="fill-redDim" />
      <path
        d="M12 12l12 12M24 12L12 24"
        stroke="#EF4444"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function ExecutedPanel({ result, stateId, onReset }: ExecutedPanelProps) {
  const rejected = result.approval_status === 'rejected'
  const er = result.executed_result

  return (
    <div className="animate-entrance w-full bg-surface rounded-lg p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {rejected ? <XIcon /> : <CheckIcon />}
        <div className="flex flex-col gap-1">
          <h2 className="text-text text-2xl font-sans font-semibold leading-tight">
            {rejected ? 'Rejected — No Action Taken' : 'Work Order Created'}
          </h2>
          {!rejected && er && (
            <span className="text-accent font-mono text-base">
              {er.work_order_ref}
            </span>
          )}
        </div>
      </div>

      {/* Action items taken */}
      {!rejected && er && er.action_items_taken.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-dim text-xs font-mono uppercase tracking-widest">
            Actions Executed
          </span>
          <ol className="flex flex-col gap-2">
            {er.action_items_taken.map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="text-green font-mono text-sm shrink-0 mt-0.5">→</span>
                <span className="text-text text-sm">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Notes */}
      {!rejected && er && er.notes && (
        <p className="text-muted text-sm italic">{er.notes}</p>
      )}

      {/* Timestamp + audit */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        {!rejected && er && (
          <span className="text-dim text-xs font-mono">
            Executed at {formatTime(er.executed_at)}
          </span>
        )}
        <a
          href={`http://localhost:8001/audit/${stateId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue text-xs font-mono hover:underline self-start"
        >
          View audit record →
        </a>
      </div>

      {/* Reset */}
      <div>
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm font-mono text-muted border border-border rounded hover:border-borderStrong hover:text-text transition-colors"
          aria-label="Start a new session"
        >
          Start new session
        </button>
      </div>
    </div>
  )
}
