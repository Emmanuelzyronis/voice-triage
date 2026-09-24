'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AppPhase,
  ApprovalPayload,
  PipelineCompletePayload,
  PipelineStage,
  StageStatus,
} from '@/lib/types'

export interface ApprovalDecision {
  status: 'approved' | 'rejected' | 'edited'
  reviewer_note?: string
  edited_body?: string
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

const WS_URL = 'ws://localhost:8001/ws/audio?tenant_id=apex-field-services'
const APPROVE_URL = (id: string) => `http://localhost:8001/approve/${id}`

export function usePipeline() {
  const [phase, setPhase] = useState<AppPhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [stages, setStages] = useState<Record<PipelineStage, StageStatus>>(INITIAL_STAGES)
  const [approval, setApproval] = useState<ApprovalPayload | null>(null)
  const [result, setResult] = useState<PipelineCompletePayload | null>(null)
  const [micLevel, setMicLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  // Keep a stable ref to the current phase so handlers don't close over stale value
  const phaseRef = useRef<AppPhase>('idle')

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function teardown() {
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

      case 'stage_update': {
        const stage = msg.stage as PipelineStage
        const status = msg.status as StageStatus
        setStages((prev) => ({ ...prev, [stage]: status }))
        if (phaseRef.current !== 'pipeline' && phaseRef.current !== 'approval' && phaseRef.current !== 'executing') {
          setPhase('pipeline')
        }
        break
      }

      case 'approval_required': {
        const payload = msg as unknown as ApprovalPayload
        setApproval(payload)
        // Persist transcript text so it stays visible during and after the approval phase
        if (payload.parsed?.raw_text) {
          setTranscript(payload.parsed.raw_text)
        }
        setPhase('approval')
        break
      }

      case 'pipeline_complete':
        setResult(msg as unknown as PipelineCompletePayload)
        setPhase('complete')
        // Pipeline is done — safe to close the WebSocket now
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

    // 1. Open WebSocket first
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
      // Only treat as error if we're in an active state and it wasn't a clean close
      if (!ev.wasClean && phaseRef.current !== 'complete' && phaseRef.current !== 'idle') {
        setError('Connection closed unexpectedly')
        setPhase('error')
      }
    }

    // 2. Wait for WS to open before touching mic
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      setTimeout(() => reject(new Error('WS open timeout')), 5000)
    })

    // 3. Get mic stream
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
    } catch (err) {
      setError('Microphone access denied')
      setPhase('error')
      ws.close()
      return
    }
    streamRef.current = stream

    // 4. AudioContext at 16kHz
    const ctx = new AudioContext({ sampleRate: 16000 })
    audioCtxRef.current = ctx

    try {
      await ctx.audioWorklet.addModule('/audio-processor.js')
    } catch (err) {
      setError('AudioWorklet failed to load')
      setPhase('error')
      stream.getTracks().forEach((t) => t.stop())
      ws.close()
      return
    }

    const source = ctx.createMediaStreamSource(stream)
    const workletNode = new AudioWorkletNode(ctx, 'audio-capture-processor')

    // 5. Forward PCM to WS + compute level meter
    workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(e.data)
      }
      // RMS level for the meter
      const int16 = new Int16Array(e.data)
      let sum = 0
      for (let i = 0; i < int16.length; i++) {
        sum += (int16[i] / 32768) ** 2
      }
      const rms = Math.sqrt(sum / int16.length)
      setMicLevel(Math.min(1, rms * 8))
    }

    source.connect(workletNode)
    // Don't connect worklet to destination — we don't want to hear ourselves
    // workletNode.connect(ctx.destination)

    setPhase('recording')
  }, [handleServerMessage])

  const stopRecording = useCallback(() => {
    // Stop mic tracks — no more audio to send
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close()
    }
    audioCtxRef.current = null

    // Send STOP signal instead of closing the WebSocket.
    // The backend calls listen.close() on "STOP", which triggers AssemblyAI
    // finalization and fires on_final. The WS stays open so stage events,
    // approval_required, and pipeline_complete can still reach the browser.
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('STOP')
    }

    setMicLevel(0)
    setPhase('transcribing')
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
    setTranscript(null)
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
  }
}
