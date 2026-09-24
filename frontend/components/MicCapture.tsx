'use client'

import type { AppPhase } from '@/lib/types'

interface MicCaptureProps {
  phase: AppPhase
  micLevel: number
  onStart: () => void
  onStop: () => void
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0014 0" />
      <line x1="12" y1="20" x2="12" y2="17" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

function statusText(phase: AppPhase): React.ReactNode {
  switch (phase) {
    case 'idle':
      return 'Ready — click to record'
    case 'recording':
      return 'Recording… click to stop'
    case 'transcribing':
      return (
        <span>
          Transcribing
          <span className="animate-[blink_1s_step-end_infinite]">_</span>
        </span>
      )
    case 'pipeline':
    case 'approval':
    case 'executing':
      return 'Processing'
    case 'complete':
      return 'Done'
    case 'error':
      return 'Error — reset to retry'
    default:
      return null
  }
}

export function MicCapture({ phase, micLevel, onStart, onStop }: MicCaptureProps) {
  const isIdle = phase === 'idle'
  const isRecording = phase === 'recording'
  const isDisabled = !isIdle && !isRecording

  function handleClick() {
    if (isIdle) onStart()
    else if (isRecording) onStop()
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      {/* Button + pulse ring */}
      <div className="relative">
        {isRecording && (
          <span className="absolute inset-0 rounded-full bg-red opacity-30 animate-ping" />
        )}
        <button
          onClick={handleClick}
          disabled={isDisabled}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          className={[
            'relative w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            isIdle
              ? 'bg-accent text-bg hover:brightness-110 focus-visible:ring-accent'
              : isRecording
              ? 'bg-red text-white focus-visible:ring-red'
              : 'bg-surface2 text-dim cursor-not-allowed',
          ].join(' ')}
        >
          {isRecording ? <StopIcon /> : <MicIcon />}
        </button>
      </div>

      <span className="text-xs font-mono text-dim">{isIdle ? 'Start' : isRecording ? 'Stop' : ''}</span>

      {/* Level meter — only while recording */}
      {isRecording && (
        <div className="w-[200px] h-1 bg-surface2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-75"
            style={{ width: `${Math.min(1, micLevel) * 100}%` }}
          />
        </div>
      )}

      {/* Status text */}
      <p className="text-sm font-mono text-muted">{statusText(phase)}</p>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}
