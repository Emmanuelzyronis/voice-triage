'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CallSummary } from '@/components/CallCard'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8001'
const POLL_MS = 3000

function rowToCallSummary(r: Record<string, unknown>): CallSummary {
  const parsed = r.parsed as Record<string, unknown> | null
  const draft = r.draft as Record<string, unknown> | null

  // Derive urgency from category / evaluation
  const cat = String(r.category ?? '')
  const urgency: CallSummary['urgency'] =
    cat === 'urgent' || cat === 'escalate' ? 'high' :
    cat === 'standard' ? 'medium' : 'low'

  return {
    id: String(r.id ?? r.state_id),
    tenant_id: String(r.tenant_id ?? ''),
    status: (r.status as CallSummary['status']) ?? 'active',
    category: cat || 'unknown',
    urgency,
    created_at: String(r.created_at ?? new Date().toISOString()),
    caller_snippet: String(parsed?.summary ?? r.caller_id ?? ''),
    draft_summary: String(draft?.response_body ?? draft?.summary ?? ''),
    elapsed_seconds: 0,
  }
}

export function useCalls(tenantSlug: string | null) {
  const [activeCalls, setActiveCalls] = useState<CallSummary[]>([])
  const [pendingCalls, setPendingCalls] = useState<CallSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCalls = useCallback(async () => {
    const params = new URLSearchParams()
    if (tenantSlug) params.set('tenant_id', tenantSlug)

    try {
      const [activeRes, pendingRes] = await Promise.all([
        fetch(`${BACKEND}/calls?${params}&status=active`),
        fetch(`${BACKEND}/calls?${params}&status=pending_approval`),
      ])

      if (!activeRes.ok || !pendingRes.ok) {
        setError('Backend unreachable')
        return
      }

      const [activeRows, pendingRows] = await Promise.all([
        activeRes.json() as Promise<Record<string, unknown>[]>,
        pendingRes.json() as Promise<Record<string, unknown>[]>,
      ])

      setActiveCalls(activeRows.map(rowToCallSummary))
      setPendingCalls(pendingRows.map(rowToCallSummary))
      setError(null)
    } catch {
      setError('Could not reach backend — is it running on port 8001?')
    } finally {
      setLoading(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    fetchCalls()
    intervalRef.current = setInterval(fetchCalls, POLL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchCalls])

  return { activeCalls, pendingCalls, loading, error, refetch: fetchCalls }
}
