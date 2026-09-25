'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AppPhase,
  ApprovalPayload,
  ConversationTurn,
  PipelineCompletePayload,
  PipelineStage,
  StageStatus,
} from '@/lib/types'

export interface ApprovalDecision {
  status: 'approved' | 'rejected' | 'edited'
  reviewer_note?: string
  edited_body?: string
  edited_action_items?: string[]
}

const INITIAL_STAGES: Record<PipelineStage, StageStatus> = {
  parse: 'idle',
  classify: 'idle',
  research: 'idle',
  draft: 'idle',
  evaluate: 'idle',
  approve: 'idle',
  execute: 'idle',
}

const WS_URL = 'ws://localhost:8001/ws/conversation?tenant_id=apex-field-services'
const APPROVE_URL = (id: string) => `http://localhost:8001/approve/${id}`
const TTS_URL = 'http://localhost:8001/tts'

// Queue so overlapping AI turns don't collide
let _ttsAudio: HTMLAudioElement | null = null

async function speak(text: string) {
  if (typeof window === 'undefined') return
  // Stop any in-flight audio
  if (_ttsAudio) {
    _ttsAudio.pause()
    _ttsAudio = null
  }
  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'nova' }),
    })
    if (!res.ok) throw new Error(`TTS ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    _ttsAudio = audio
    audio.onended = () => URL.revokeObjectURL(url)
    await audio.play()
  } catch (err) {
    console.warn('TTS failed, falling back to browser voice:', err)
    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis?.cancel()
    window.speechSynthesis?.speak(utterance)
  }
}

export function usePipeline() {
  const [phase, setPhase] = useState<AppPhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([])
  const [partialText, setPartialText] = useState<string | null>(null)
  const [stages, setStages] = useState<Record<PipelineStage, StageStatus>>(INITIAL_STAGES)
  const [approval, setApproval] = useState<ApprovalPayload | null>(null)
  const [result, setResult] = useState<PipelineCompletePayload | null>(null)
  const [micLevel, setMicLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const phaseRef = useRef<AppPhase>('idle')

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    return () => { teardown() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function teardown() {
    if (_ttsAudio) { _ttsAudio.pause(); _ttsAudio = null }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close()
    }
    audioCtxRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    setMicLevel(0)
  }

  const handleServerMessage = useCallback((msg: Record<string, unknown>) => {
    switch (msg.type) {
      case 'session_started':
        setSessionId(msg.state_id as string)
        setTenantName(msg.tenant as string)
        break

      case 'conversation_turn': {
        const role = msg.role as 'user' | 'assistant'
        const text = msg.text as string
        setConversationTurns((prev) => [...prev, { role, text }])
        // Clear partial when user turn is finalised
        if (role === 'user') setPartialText(null)
        // Speak AI responses
        if (role === 'assistant') speak(text)
        setPhase('conversation')
        break
      }

      case 'user_partial':
        setPartialText(msg.text as string)
        break

      case 'conversation_complete':
        if (_ttsAudio) { _ttsAudio.pause(); _ttsAudio = null }
        setPartialText(null)
        setPhase('pipeline')
        break

      case 'stage_update': {
        const stage = msg.stage as PipelineStage
        const status = msg.status as StageStatus
        setStages((prev) => ({ ...prev, [stage]: status }))
        if (
          phaseRef.current !== 'pipeline' &&
          phaseRef.current !== 'approval' &&
          phaseRef.current !== 'executing'
        ) {
          setPhase('pipeline')
        }
        break
      }

      case 'approval_required': {
        const payload = msg as unknown as ApprovalPayload
        setApproval(payload)
        setPhase('approval')
        break
      }

      case 'pipeline_complete':
        setResult(msg as unknown as PipelineCompletePayload)
        setPhase('complete')
        wsRef.current?.close()
        break

      case 'error':
        setError(msg.message as string)
        setPhase('error')
        break
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        handleServerMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection failed — is the backend running on port 8001?')
      setPhase('error')
    }

    ws.onclose = (ev) => {
      if (!ev.wasClean && phaseRef.current !== 'complete' && phaseRef.current !== 'idle') {
        setError('Connection closed unexpectedly')
        setPhase('error')
      }
    }

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      setTimeout(() => reject(new Error('WS open timeout')), 5000)
    })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
    } catch {
      setError('Microphone access denied')
      setPhase('error')
      ws.close()
      return
    }
    streamRef.current = stream

    const ctx = new AudioContext({ sampleRate: 16000 })
    audioCtxRef.current = ctx

    try {
      await ctx.audioWorklet.addModule('/audio-processor.js')
    } catch {
      setError('AudioWorklet failed to load')
      setPhase('error')
      stream.getTracks().forEach((t) => t.stop())
      ws.close()
      return
    }

    const source = ctx.createMediaStreamSource(stream)
    const workletNode = new AudioWorkletNode(ctx, 'audio-capture-processor')

    workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(e.data)
      }
      const int16 = new Int16Array(e.data)
      let sum = 0
      for (let i = 0; i < int16.length; i++) {
        sum += (int16[i] / 32768) ** 2
      }
      setMicLevel(Math.min(1, Math.sqrt(sum / int16.length) * 8))
    }

    source.connect(workletNode)
    setPhase('recording')
  }, [handleServerMessage])

  const stopRecording = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close()
    }
    audioCtxRef.current = null
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('STOP')
    }
    setMicLevel(0)
  }, [])

  const submitApproval = useCallback(
    async (decision: ApprovalDecision) => {
      if (!sessionId) return
      setPhase('executing')
      try {
        await fetch(APPROVE_URL(sessionId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(decision),
        })
      } catch {
        setError('Failed to submit approval — check backend connection')
        setPhase('error')
      }
    },
    [sessionId],
  )

  const reset = useCallback(() => {
    teardown()
    setPhase('idle')
    setSessionId(null)
    setTenantName(null)
    setConversationTurns([])
    setPartialText(null)
    setStages(INITIAL_STAGES)
    setApproval(null)
    setResult(null)
    setMicLevel(0)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
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
  }
}
