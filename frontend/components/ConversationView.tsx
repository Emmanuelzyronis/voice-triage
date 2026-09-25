'use client'

import { useEffect, useRef } from 'react'
import type { AppPhase, ConversationTurn } from '@/lib/types'

interface ConversationViewProps {
  turns: ConversationTurn[]
  partialText: string | null
  phase: AppPhase
  tenantName: string | null
  compact?: boolean
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-accent opacity-60"
          style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </span>
  )
}

function AssistantIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
      <svg className="w-3 h-3 text-bg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    </div>
  )
}

export default function ConversationView({
  turns,
  partialText,
  phase,
  tenantName,
  compact = false,
}: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, partialText])

  const isProcessing = phase === 'pipeline'
  const lastRole = turns.length > 0 ? turns[turns.length - 1].role : null
  const showThinking = lastRole === 'user' && phase === 'conversation'

  return (
    <div className={`w-full flex flex-col gap-3 ${compact ? '' : 'animate-entrance'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center gap-2 pb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span className="text-xs font-mono text-muted">
            {tenantName ?? 'Live Call'}
          </span>
        </div>
      )}

      {/* Conversation bubbles */}
      <div
        className={`flex flex-col gap-3 ${
          compact
            ? 'max-h-32 overflow-y-auto'
            : 'max-h-[420px] overflow-y-auto pr-1'
        }`}
      >
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`flex gap-2 animate-entrance ${
              turn.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {turn.role === 'assistant' && <AssistantIcon />}

            <div
              className={`max-w-[78%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                turn.role === 'user'
                  ? 'bg-surface2 text-text rounded-tr-sm'
                  : 'bg-blueDim text-text rounded-tl-sm'
              }`}
            >
              {turn.text}
            </div>
          </div>
        ))}

        {/* Partial text — user still speaking */}
        {partialText && (
          <div className="flex justify-end">
            <div className="max-w-[78%] rounded-lg rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed bg-surface2 text-muted italic border border-border">
              {partialText}
            </div>
          </div>
        )}

        {/* Thinking indicator — waiting for AI response */}
        {showThinking && (
          <div className="flex gap-2 justify-start animate-fade">
            <AssistantIcon />
            <div className="bg-blueDim rounded-lg rounded-tl-sm px-4 py-3">
              <ThinkingDots />
            </div>
          </div>
        )}

        {/* Processing indicator — conversation done, pipeline running */}
        {isProcessing && (
          <div className="flex gap-2 justify-start animate-fade">
            <AssistantIcon />
            <div className="bg-surface rounded-lg rounded-tl-sm px-4 py-2.5 text-sm text-muted font-mono">
              Processing your request
              <span className="animate-[blink_1s_step-end_infinite]">_</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}
