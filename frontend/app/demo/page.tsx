'use client'

/**
 * Demo/test page — renders all panels with mock data for visual verification.
 * Not shown in production; only for dev testing and screenshots.
 */

import ApprovalGate from '@/components/ApprovalGate'
import ExecutedPanel from '@/components/ExecutedPanel'
import { PipelineStatus } from '@/components/PipelineStatus'
import { TranscriptPanel } from '@/components/TranscriptPanel'
import type { ApprovalDecision } from '@/hooks/usePipeline'
import type { ApprovalPayload, PipelineCompletePayload, PipelineStage, StageStatus } from '@/lib/types'
import { useState } from 'react'

const MOCK_APPROVAL: ApprovalPayload = {
  state_id: 'demo-1234abcd',
  category: 'action_required',
  classify_reason: 'Caller reported HVAC unit down with no cooling, high urgency, property at risk.',
  parsed: {
    raw_text: "Yeah hi, this is Marcus at unit 14B, my AC has been out since yesterday morning and it's like 95 degrees in here, I've got a newborn baby and this really needs to be fixed today.",
    intent: 'Emergency HVAC repair request — no cooling, infant at risk',
    entities: { unit: '14B', reporter: 'Marcus', issue: 'AC failure', duration: '~24 hours' },
    urgency: 'critical',
    evidence: {
      observed: ['Caller states AC out since yesterday morning', 'Infant present', 'Temperature 95°F reported'],
      inferred: ['Priority-1 dispatch required per SLA'],
      unknown: ['Model number of unit', 'Last service date', 'Whether landlord has been notified'],
    },
  },
  draft: {
    greeting: 'Hello Marcus',
    body: "We've logged your emergency HVAC request for unit 14B. Given the presence of a newborn and the reported temperature, this has been escalated to a Priority-1 dispatch. A technician will be at your location within 2 hours.",
    action_items: ['Dispatch Priority-1 HVAC technician to unit 14B', 'Notify on-call supervisor', 'Log as emergency ticket'],
    closing: 'We will call 15 minutes before arrival.',
    caveats: ['Model number not confirmed — tech will diagnose on arrival', 'Last service date unknown — could affect repair time'],
  },
  evaluation: {
    addresses_intent: true,
    factually_grounded: true,
    tone_appropriate: true,
    issues_found: [
      'Draft commits to 2-hour response but does not confirm technician availability',
      'No mention of escalation path if 2-hour window cannot be met',
      'Caveats about model number should be relayed to the technician, not the caller',
    ],
    overall: 'NEEDS_EDIT',
  },
}

const MOCK_STAGES: Record<PipelineStage, StageStatus> = {
  parse: 'complete',
  classify: 'complete',
  research: 'complete',
  draft: 'complete',
  evaluate: 'complete',
  approve: 'running',
  execute: 'idle',
}

const MOCK_RESULT: PipelineCompletePayload = {
  state_id: 'demo-1234abcd',
  executed: true,
  approval_status: 'approved',
  executed_result: {
    work_order_ref: 'apex-field-services-1234abcd',
    action_items_taken: ['Dispatch Priority-1 HVAC technician to unit 14B', 'Notify on-call supervisor', 'Log as emergency ticket'],
    executed_at: new Date().toISOString(),
    notes: 'Priority-1 escalation confirmed. Tech ETA 90 minutes.',
  },
}

export default function DemoPage() {
  const [view, setView] = useState<'approval' | 'executing' | 'complete' | 'pipeline'>('approval')

  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      <header className="border-b border-border px-6 py-3 flex items-center gap-4">
        <span className="text-xs font-mono text-dim">Demo view</span>
        <div className="flex gap-2">
          {(['pipeline', 'approval', 'executing', 'complete'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={v === view ? 'btn-primary text-xs py-1 px-3' : 'btn-ghost text-xs py-1 px-3'}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <TranscriptPanel
          phase={view === 'pipeline' ? 'pipeline' : 'approval'}
          transcript={MOCK_APPROVAL.parsed?.raw_text ?? null}
        />

        {view === 'pipeline' && (
          <PipelineStatus stages={MOCK_STAGES} phase="pipeline" />
        )}

        {(view === 'approval' || view === 'executing') && (
          <>
            <PipelineStatus stages={MOCK_STAGES} phase={view} />
            <ApprovalGate
              approval={MOCK_APPROVAL}
              phase={view}
              onDecide={(d: ApprovalDecision) => {
                console.log('decision:', d)
                setView('complete')
              }}
            />
          </>
        )}

        {view === 'complete' && (
          <>
            <PipelineStatus
              stages={{ ...MOCK_STAGES, approve: 'complete', execute: 'complete' }}
              phase="complete"
            />
            <ExecutedPanel
              result={MOCK_RESULT}
              stateId="demo-1234abcd"
              onReset={() => setView('approval')}
            />
          </>
        )}
      </main>
    </div>
  )
}
