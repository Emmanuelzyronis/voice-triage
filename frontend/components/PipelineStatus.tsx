'use client'

import type { AppPhase, PipelineStage, StageStatus } from '@/lib/types'

interface PipelineStatusProps {
  stages: Record<PipelineStage, StageStatus>
  phase: AppPhase
}

const STAGE_ORDER: PipelineStage[] = [
  'parse',
  'classify',
  'research',
  'draft',
  'evaluate',
  'approve',
  'execute',
]

const STAGE_LABELS: Record<PipelineStage, string> = {
  parse: 'Parse',
  classify: 'Classify',
  research: 'Retrieve',
  draft: 'Draft',
  evaluate: 'Evaluate',
  approve: 'Approve',
  execute: 'Execute',
}

function RunningIcon() {
  return (
    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  )
}

function CompleteIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

const chipStyles: Record<StageStatus, string> = {
  idle: 'bg-surface2 text-dim border-border',
  running: 'bg-amber-950/60 text-accent border-accent',
  complete: 'bg-emerald-950/60 text-green border-green',
  error: 'bg-red-950/60 text-red border-red',
}

function StageChip({ stage, status }: { stage: PipelineStage; status: StageStatus }) {
  return (
    <span
      className={[
        'text-xs font-mono px-3 py-1 rounded-full border flex items-center gap-1.5 transition-colors duration-300',
        chipStyles[status],
      ].join(' ')}
    >
      {status === 'running' && <RunningIcon />}
      {status === 'complete' && <CompleteIcon />}
      {status === 'error' && <ErrorIcon />}
      {STAGE_LABELS[stage]}
    </span>
  )
}

export function PipelineStatus({ stages, phase }: PipelineStatusProps) {
  const visible = ['pipeline', 'approval', 'executing', 'complete'].includes(phase)
  if (!visible) return null

  return (
    <div className="w-full bg-surface border border-border rounded-md px-5 py-4 space-y-3">
      <p className="text-xs font-mono text-dim uppercase tracking-widest">Pipeline</p>
      <div className="flex flex-wrap gap-2 items-center">
        {STAGE_ORDER.map((stage, i) => (
          <span key={stage} className="flex items-center gap-2">
            <StageChip stage={stage} status={stages[stage]} />
            {i < STAGE_ORDER.length - 1 && (
              <span className="text-dim text-xs select-none">→</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
