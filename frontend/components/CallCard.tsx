'use client'

import CategoryBadge from './CategoryBadge'
import LiveWaveform from './LiveWaveform'

export interface CallSummary {
  id: string
  tenant_id: string
  status: 'active' | 'pending_approval' | 'approved' | 'rejected' | 'executed'
  category: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  caller_snippet: string
  draft_summary: string
  elapsed_seconds: number
}

interface CallCardProps {
  call: CallSummary
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onClick?: (id: string) => void
}

const URGENCY_DOT: Record<string, string> = {
  low:      'bg-green',
  medium:   'bg-accent',
  high:     'bg-red animate-pulse',
  critical: 'bg-red animate-pulse',
}

function elapsed(secs: number) {
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

export function ActiveCallCard({ call }: { call: CallSummary }) {
  return (
    <div
      className="relative overflow-hidden rounded-[6px] border border-border-strong animate-entrance"
      style={{ background: 'rgba(31,41,55,0.6)', backdropFilter: 'blur(12px)' }}
    >
      <div className="absolute inset-0 bg-white/[0.03] pointer-events-none" />
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
            <span className="text-xs font-mono text-muted">Taking call…</span>
          </div>
          <span className="text-xs font-mono text-dim">{elapsed(call.elapsed_seconds)}</span>
        </div>
        <p className="text-sm text-muted italic leading-relaxed line-clamp-2 mb-3">
          "{call.caller_snippet}"
        </p>
        <div className="flex items-center justify-between">
          <LiveWaveform />
          <CategoryBadge category={call.category} />
        </div>
      </div>
    </div>
  )
}

export default function CallCard({ call, onApprove, onReject, onClick }: CallCardProps) {
  return (
    <article
      className="panel cursor-pointer hover:border-border-strong focus-within:ring-2 focus-within:ring-blue focus-within:ring-offset-1 focus-within:ring-offset-bg transition-colors animate-entrance"
      onClick={() => onClick?.(call.id)}
      onKeyDown={e => e.key === 'Enter' && onClick?.(call.id)}
      tabIndex={0}
      role="button"
      aria-label={`Call — ${call.draft_summary || call.caller_snippet}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${URGENCY_DOT[call.urgency] ?? 'bg-muted'}`} />
          <CategoryBadge category={call.category} />
        </div>
        <span className="text-[10px] font-mono text-dim shrink-0 mt-0.5">
          {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <p className="text-sm text-text leading-snug mb-2 line-clamp-2">{call.draft_summary}</p>
      <p className="text-xs text-dim italic line-clamp-1 mb-4">"{call.caller_snippet}"</p>

      {/* Actions — stop propagation so row click doesn't fire */}
      <div className="flex gap-2" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        {onApprove && (
          <button
            onClick={() => onApprove(call.id)}
            className="flex-1 min-h-[44px] py-2 px-3 text-xs font-semibold rounded bg-green/10 text-green border border-green/25 hover:bg-green hover:text-bg transition-colors cursor-pointer"
          >
            Approve
          </button>
        )}
        {onReject && (
          <button
            onClick={() => onReject(call.id)}
            className="flex-1 min-h-[44px] py-2 px-3 text-xs font-semibold rounded bg-red/10 text-red border border-red/25 hover:bg-red hover:text-white transition-colors cursor-pointer"
          >
            Reject
          </button>
        )}
        {onClick && (
          <button
            onClick={() => onClick(call.id)}
            className="min-h-[44px] py-2 px-3 text-xs text-muted border border-border rounded hover:bg-surface2 hover:text-text transition-colors cursor-pointer"
          >
            Details
          </button>
        )}
      </div>
    </article>
  )
}
