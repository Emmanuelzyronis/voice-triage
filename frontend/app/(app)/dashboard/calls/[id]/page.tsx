'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import CategoryBadge from '@/components/CategoryBadge'
import ConversationView from '@/components/ConversationView'
import type { ConversationTurn } from '@/lib/types'

// Placeholder — replace with Supabase fetch by params.id
const MOCK_CALL = {
  id: 'call-2',
  status: 'pending_approval',
  category: 'urgent',
  urgency: 'critical' as const,
  created_at: new Date(Date.now() - 195000).toISOString(),
  transcript: [
    { role: 'assistant', text: 'Thank you for calling Apex Field Services. How can I help you today?' },
    { role: 'user',      text: 'My AC compressor is making a loud noise and I can smell something burning.' },
    { role: 'assistant', text: 'That sounds serious. Can you give me your address and which unit is affected?' },
    { role: 'user',      text: "It's 2847 Westbrook Ave, Unit 4B. I'm worried about a fire." },
    { role: 'assistant', text: "Understood — I'll escalate this as a priority emergency. Is anyone in immediate danger?" },
    { role: 'user',      text: 'No, but please hurry. The smell is getting stronger.' },
    { role: 'assistant', text: "Absolutely. I'm logging an emergency dispatch to 2847 Westbrook Ave, Unit 4B right now." },
  ] as ConversationTurn[],
  parsed: {
    intent: 'emergency_hvac_repair',
    entities: { equipment: 'AC compressor', issue: 'loud noise, burning smell', address: '2847 Westbrook Ave, Unit 4B' },
    urgency: 'critical',
    evidence: {
      observed: ['Burning smell reported', 'Unusual loud compressor noise'],
      inferred: ['Potential fire risk', 'Immediate service required'],
      unknown: ['Duration of issue', 'Building type'],
    },
  },
  draft: {
    greeting: 'Priority Dispatch — Emergency HVAC',
    body: 'Customer reports burning smell and loud noise from AC compressor at 2847 Westbrook Ave, Unit 4B. Situation classified as potential fire risk. Immediate response required.',
    action_items: [
      'Dispatch emergency HVAC technician to 2847 Westbrook Ave, Unit 4B',
      'Call customer to confirm technician ETA',
      'Technician to bring fire safety kit',
    ],
    closing: 'Time-sensitive — customer monitoring situation actively.',
    caveats: ['Verify building access code before dispatch'],
  },
  evaluation: { overall: 'PASS' as const, issues_found: [] as string[] },
}

const URGENCY_COLOR: Record<string, string> = {
  low: 'text-green', medium: 'text-accent', high: 'text-red', critical: 'text-red',
}

export default function CallDetailPage() {
  const params = useParams()
  const router = useRouter()
  // params.id used for real fetch — MOCK_CALL stands in for demo
  void params.id

  const call = MOCK_CALL
  const [note, setNote]           = useState('')
  const [body, setBody]           = useState(call.draft.body)
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [done, setDone]           = useState<'approve' | 'reject' | null>(null)

  const decide = async (action: 'approve' | 'reject') => {
    setSubmitting(action)
    await new Promise(r => setTimeout(r, 700))
    setSubmitting(null)
    setDone(action)
  }

  if (done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${done === 'approve' ? 'bg-green/20' : 'bg-red/20'}`}>
          {done === 'approve'
            ? <svg className="w-6 h-6 text-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>
            : <svg className="w-6 h-6 text-red"   viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          }
        </div>
        <p className="text-text font-medium">{done === 'approve' ? 'Approved & dispatched' : 'Call rejected'}</p>
        <button onClick={() => router.push('/dashboard')} className="btn-ghost text-sm">← Back to dashboard</button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Header */}
      <header className="px-8 py-5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-surface2 text-muted hover:text-text transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 className="text-text font-semibold">Call Review</h1>
          <CategoryBadge category={call.category} size="md" />
          <span className={`text-xs font-mono font-bold uppercase ${URGENCY_COLOR[call.urgency]}`}>
            {call.urgency}
          </span>
        </div>
        <span className="text-[10px] font-mono text-dim">{call.id.slice(0, 8)}</span>
      </header>

      {/* Two panels */}
      <div className="flex-1 flex gap-px bg-border overflow-hidden">

        {/* Left — transcript + entities */}
        <div className="flex-1 bg-bg overflow-y-auto p-6 flex flex-col gap-5 min-w-0">
          <div className="panel">
            <h2 className="text-[10px] font-mono text-dim uppercase tracking-widest mb-4">Call Transcript</h2>
            <ConversationView
              turns={call.transcript}
              partialText={null}
              phase="complete"
              tenantName={null}
            />
          </div>

          <div className="panel">
            <h2 className="text-[10px] font-mono text-dim uppercase tracking-widest mb-4">Extracted Information</h2>
            <div className="flex flex-col gap-2.5">
              {Object.entries(call.parsed.entities).map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-[10px] font-mono text-dim uppercase w-20 shrink-0 pt-0.5 tracking-wide">{k.replace('_', ' ')}</span>
                  <span className="text-sm text-text">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4">
              {(['observed', 'inferred', 'unknown'] as const).map(t => (
                <div key={t}>
                  <p className="text-[10px] font-mono text-dim uppercase tracking-wide mb-2">{t}</p>
                  <ul className="space-y-1">
                    {call.parsed.evidence[t].map((item, i) => (
                      <li key={i} className="text-xs text-muted flex gap-1.5"><span className="text-dim">·</span>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — draft + decision */}
        <div className="w-[380px] shrink-0 bg-bg overflow-y-auto p-6 flex flex-col gap-5">
          <div className="panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-mono text-dim uppercase tracking-widest">AI Draft</h2>
              <span className={`text-[10px] font-mono font-bold ${
                call.evaluation.overall === 'PASS' ? 'text-green' :
                call.evaluation.overall === 'FAIL' ? 'text-red' : 'text-accent'
              }`}>{call.evaluation.overall}</span>
            </div>
            <p className="text-sm font-semibold text-text mb-3">{call.draft.greeting}</p>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              className="w-full text-sm text-text bg-surface2 border border-border rounded p-3 resize-none leading-relaxed focus:outline-none focus:border-blue transition-colors"
              aria-label="Edit draft body"
            />
            <ul className="mt-3 space-y-1.5">
              {call.draft.action_items.map((item, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted">
                  <span className="text-dim shrink-0">{i + 1}.</span>{item}
                </li>
              ))}
            </ul>
            {call.draft.caveats[0] && (
              <p className="mt-3 pt-3 border-t border-border text-xs text-accent">
                Note: {call.draft.caveats[0]}
              </p>
            )}
          </div>

          <div className="panel">
            <label className="text-[10px] font-mono text-dim uppercase tracking-widest block mb-3" htmlFor="reviewer-note">
              Reviewer Note (optional)
            </label>
            <textarea
              id="reviewer-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note for the audit log…"
              rows={3}
              className="w-full text-sm text-muted bg-surface2 border border-border rounded p-3 resize-none focus:outline-none focus:border-blue transition-colors placeholder:text-dim"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => decide('approve')}
              disabled={!!submitting}
              className="w-full min-h-[44px] py-3 px-4 rounded bg-green/10 text-green border border-green/30 hover:bg-green hover:text-bg font-semibold text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting === 'approve' ? 'Approving…' : 'Approve & Execute'}
            </button>
            <button
              onClick={() => decide('reject')}
              disabled={!!submitting}
              className="w-full min-h-[44px] py-3 px-4 rounded bg-red/10 text-red border border-red/30 hover:bg-red hover:text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
