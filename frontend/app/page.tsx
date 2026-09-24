'use client'

import { usePipeline } from '@/hooks/usePipeline'
import type { ApprovalDecision } from '@/hooks/usePipeline'
import { MicCapture } from '@/components/MicCapture'
import { TranscriptPanel } from '@/components/TranscriptPanel'
import { PipelineStatus } from '@/components/PipelineStatus'
import ApprovalGate from '@/components/ApprovalGate'
import ExecutedPanel from '@/components/ExecutedPanel'

const PHASE_LABELS: Record<string, string> = {
  idle: 'Ready',
  recording: 'Recording',
  transcribing: 'Transcribing',
  pipeline: 'Processing',
  approval: 'Awaiting Review',
  executing: 'Executing',
  complete: 'Complete',
  error: 'Error',
}

export default function Home() {
  const {
    phase,
    sessionId,
    tenantName,
    transcript,
    stages,
    approval,
    result,
    micLevel,
    error,
    startRecording,
    stopRecording,
    submitApproval,
    reset,
  } = usePipeline()

  function handleDecide(decision: ApprovalDecision) {
    submitApproval(decision)
  }

  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo mark */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-bg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-text font-semibold text-sm tracking-tight">ArkOps</span>
          </div>

          {/* Tenant name */}
          {tenantName && (
            <span className="text-dim font-mono text-xs border-l border-border pl-4">
              {tenantName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Phase indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              phase === 'recording' ? 'bg-red animate-pulse' :
              phase === 'pipeline' || phase === 'transcribing' ? 'bg-accent animate-pulse' :
              phase === 'approval' ? 'bg-blue' :
              phase === 'complete' ? 'bg-green' :
              phase === 'error' ? 'bg-red' :
              'bg-surface2'
            }`} />
            <span className="font-mono text-xs text-muted">{PHASE_LABELS[phase] ?? phase}</span>
          </div>

          {/* Session ID */}
          {sessionId && (
            <span className="font-mono text-xs text-dim hidden sm:block">
              {sessionId.slice(0, 8)}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Error banner */}
        {phase === 'error' && error && (
          <div className="bg-redDim border border-red rounded-md px-4 py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-red text-sm font-mono font-medium">Error</p>
              <p className="text-text text-sm mt-0.5">{error}</p>
            </div>
            <button
              onClick={reset}
              className="btn-ghost text-xs shrink-0"
            >
              Reset
            </button>
          </div>
        )}

        {/* Mic control */}
        <section className="flex flex-col items-center py-6">
          <MicCapture
            phase={phase}
            micLevel={micLevel}
            onStart={startRecording}
            onStop={stopRecording}
          />
        </section>

        {/* Transcript */}
        {phase !== 'idle' && (
          <TranscriptPanel phase={phase} transcript={transcript} />
        )}

        {/* Pipeline stage progress */}
        {(phase === 'pipeline' || phase === 'approval' || phase === 'executing' || phase === 'complete') && (
          <PipelineStatus stages={stages} phase={phase} />
        )}

        {/* Approval gate — the centrepiece */}
        {phase === 'approval' && approval && (
          <ApprovalGate
            approval={approval}
            phase={phase}
            onDecide={handleDecide}
          />
        )}

        {/* Also show gate when executing (disabled, spinner) */}
        {phase === 'executing' && approval && (
          <ApprovalGate
            approval={approval}
            phase={phase}
            onDecide={handleDecide}
          />
        )}

        {/* Result panel */}
        {phase === 'complete' && result && sessionId && (
          <ExecutedPanel
            result={result}
            stateId={sessionId}
            onReset={reset}
          />
        )}

        {/* Idle landing state */}
        {phase === 'idle' && (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <p className="text-muted text-sm max-w-sm">
              Record a field service call. ArkOps will parse, classify, draft a response, evaluate it adversarially, and route it to you for one-click approval.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {['Parse', 'Classify', 'Retrieve', 'Draft', 'Evaluate', 'Approve', 'Execute'].map((s) => (
                <span key={s} className="stage-badge">{s}</span>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
