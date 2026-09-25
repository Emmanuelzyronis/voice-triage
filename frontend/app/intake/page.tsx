'use client'

import { usePipeline } from '@/hooks/usePipeline'
import type { ApprovalDecision } from '@/hooks/usePipeline'
import { MicCapture } from '@/components/MicCapture'
import { PipelineStatus } from '@/components/PipelineStatus'
import ApprovalGate from '@/components/ApprovalGate'
import ExecutedPanel from '@/components/ExecutedPanel'
import ConversationView from '@/components/ConversationView'

const PHASE_LABELS: Record<string, string> = {
  idle: 'Ready',
  recording: 'Connected',
  conversation: 'Live Call',
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
    conversationTurns,
    partialText,
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

  const showMic = phase === 'idle' || phase === 'recording' || phase === 'conversation'
  const showPipeline = phase === 'pipeline' || phase === 'approval' || phase === 'executing' || phase === 'complete'

  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-bg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-text font-semibold text-sm tracking-tight">ArkOps</span>
          </div>

          {tenantName && (
            <span className="text-dim font-mono text-xs border-l border-border pl-4">
              {tenantName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              phase === 'recording' || phase === 'conversation' ? 'bg-red animate-pulse' :
              phase === 'pipeline' ? 'bg-accent animate-pulse' :
              phase === 'approval' ? 'bg-blue' :
              phase === 'complete' ? 'bg-green' :
              phase === 'error' ? 'bg-red' :
              'bg-surface2'
            }`} />
            <span className="font-mono text-xs text-muted">{PHASE_LABELS[phase] ?? phase}</span>
          </div>

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
            <button onClick={reset} className="btn-ghost text-xs shrink-0">Reset</button>
          </div>
        )}

        {/* Mic control — idle / recording / conversation */}
        {showMic && (
          <section className="flex flex-col items-center py-6">
            <MicCapture
              phase={phase}
              micLevel={micLevel}
              onStart={startRecording}
              onStop={stopRecording}
            />
          </section>
        )}

        {/* Live conversation view */}
        {(phase === 'conversation' || phase === 'recording') && conversationTurns.length > 0 && (
          <div className="bg-surface border border-border rounded-md p-5">
            <ConversationView
              turns={conversationTurns}
              partialText={partialText}
              phase={phase}
              tenantName={tenantName}
            />
          </div>
        )}

        {/* Conversation context strip — compact, shown during pipeline/approval */}
        {showPipeline && conversationTurns.length > 0 && (
          <div className="bg-surface border border-border rounded-md p-4">
            <p className="text-xs font-mono text-dim uppercase tracking-widest mb-3">Call transcript</p>
            <ConversationView
              turns={conversationTurns}
              partialText={null}
              phase={phase}
              tenantName={tenantName}
              compact
            />
          </div>
        )}

        {/* Pipeline stage progress */}
        {showPipeline && (
          <PipelineStatus stages={stages} phase={phase} />
        )}

        {/* Approval gate */}
        {(phase === 'approval' || phase === 'executing') && approval && (
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
              Start a call. ArkOps will have a conversation with the caller, then route the request to you for one-click approval before executing.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {['Listen', 'Ask', 'Understand', 'Draft', 'Approve', 'Execute'].map((s) => (
                <span key={s} className="stage-badge">{s}</span>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
