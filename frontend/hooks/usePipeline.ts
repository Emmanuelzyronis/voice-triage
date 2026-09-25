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

export interface UsePipelineOptions {
  tenantSlug?: string
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

const WS_BASE = 'ws://localhost:8001/ws/conversation'
const APPROVE_URL = (id: string) => `http://localhost:8001/approve/${id}`
const TTS_URL = 'http://localhost:8001/tts'

export function usePipeline({ tenantSlug = 'apex-field-services' }: UsePipelineOptions = {}) {
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
  const audioCtxRef = useRef<AudioContext | null>(null)   // 16kHz mic context
  const ttsCtxRef = useRef<AudioContext | null>(null)     // system-rate TTS context
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const isSpeakingRef = useRef(false)
  const phaseRef = useRef<AppPhase>('idle')

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    return () => { teardown() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopTTS() {
    if (ttsSourceRef.current) {
      try { ttsSourceRef.current.stop() } catch { /* already stopped */ }
      ttsSourceRef.current = null
    }
    isSpeakingRef.current = false
    window.speechSynthesis?.cancel()
  }

  function teardown() {
    stopTTS()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close()
    audioCtxRef.current = null
    if (ttsCtxRef.current?.state !== 'closed') ttsCtxRef.current?.close()
    ttsCtxRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    setMicLevel(0)
  }

  // Decode and play TTS audio through AudioContext — avoids browser autoplay restrictions.
  // The TTS AudioContext is created during startRecording while the user gesture is live,
  // so it stays unlocked for the session's lifetime.
  const speak = useCallback(async (text: string) => {
    stopTTS()
    isSpeakingRef.current = true

    const ctx = ttsCtxRef.current
    if (!ctx || ctx.state === 'closed') {
      // No context yet (e.g. greeting arrives before mic setup) — browser fallback
      const utt = new SpeechSynthesisUtterance(text)
      utt.onend = () => { isSpeakingRef.current = false }
      window.speechSynthesis?.cancel()
      window.speechSynthesis?.speak(utt)
      return
    }

    try {
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'nova' }),
      })
      if (!res.ok) throw new Error(`TTS ${res.status}`)
      const arrayBuffer = await res.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      const source = ctx.createBufferSource()
      source.buffer = decoded
      source.connect(ctx.destination)
      ttsSourceRef.current = source
      source.onended = () => {
        isSpeakingRef.current = false
        ttsSourceRef.current = null
      }
      source.start()
    } catch (err) {
      console.warn('TTS failed, falling back to browser voice:', err)
      isSpeakingRef.current = false
      const utt = new SpeechSynthesisUtterance(text)
      utt.onend = () => { isSpeakingRef.current = false }
      window.speechSynthesis?.cancel()
      window.speechSynthesis?.speak(utt)
    }
  }, [])

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
        if (role === 'user') setPartialText(null)
        if (role === 'assistant') speak(text)
        setPhase('conversation')
        break
      }

      case 'user_partial':
        // Suppress partials while AI is speaking to avoid UI flicker from echo
        if (!isSpeakingRef.current) setPartialText(msg.text as string)
        break

      case 'conversation_complete':
        stopTTS()
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
  }, [speak])

  const startRecording = useCallback(async () => {
    setError(null)

    const wsUrl = `${WS_BASE}?tenant_id=${tenantSlug}`
    const ws = new WebSocket(wsUrl)
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
          noiseSuppression: false, // disabled — AssemblyAI voice_focus handles this server-side
        },
      })
    } catch {
      setError('Microphone access denied')
      setPhase('error')
      ws.close()
      return
    }
    streamRef.current = stream

    // Mic context — fixed at 16kHz for AssemblyAI
    const ctx = new AudioContext({ sampleRate: 16000 })
    audioCtxRef.current = ctx

    // TTS context — system sample rate, created while user gesture is live so it stays unlocked
    ttsCtxRef.current = new AudioContext()

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
      // Mute mic while AI is speaking — prevents TTS echo from triggering AssemblyAI turns
      if (ws.readyState === WebSocket.OPEN && !isSpeakingRef.current) {
        ws.send(e.data)
      }
      const int16 = new Int16Array(e.data)
      let sum = 0
      for (let i = 0; i < int16.length; i++) {
        sum += (int16[i] / 32768) ** 2
      }
      setMicLevel(isSpeakingRef.current ? 0 : Math.min(1, Math.sqrt(sum / int16.length) * 8))
    }

    source.connect(workletNode)
    setPhase('recording')
  }, [handleServerMessage, tenantSlug])

  const stopRecording = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close()
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
