'use client'

import type { AppPhase } from '@/lib/types'

interface TranscriptPanelProps {
  phase: AppPhase
  transcript: string | null
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4 text-accent"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  )
}

export function TranscriptPanel({ phase, transcript }: TranscriptPanelProps) {
  if (phase === 'idle') return null

  const showSpinner = phase === 'transcribing' && !transcript

  return (
    <div className="animate-fade w-full bg-surface border border-border rounded-md p-6 space-y-3">
      <p className="text-xs font-mono text-dim uppercase tracking-widest">Transcript</p>

      {showSpinner ? (
        <div className="flex items-center gap-2 text-muted text-sm font-mono">
          <Spinner />
          <span>Transcribing audio</span>
        </div>
      ) : transcript ? (
        <p className="text-text text-base leading-relaxed font-sans">{transcript}</p>
      ) : (
        <p className="text-dim text-sm font-mono italic">Waiting for transcript…</p>
      )}
    </div>
  )
}
