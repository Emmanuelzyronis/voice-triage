'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CallCard, { ActiveCallCard, type CallSummary } from '@/components/CallCard'
import { useCalls } from '@/hooks/useCalls'

const STAGES = ['Listen', 'Ask', 'Understand', 'Draft', 'Approve', 'Execute']
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8001'
const APPROVE_URL = (id: string) => `${BACKEND}/approve/${id}`

// Dynamically loaded (ssr:false) so Clerk hooks don't throw during SSR
const DynOrgProvider = dynamic(
  () => import('@/components/clerk-widgets').then(m => m.ClerkOrgSlug),
  { ssr: false, loading: () => <DashboardContent orgSlug="demo" /> }
)

function Skeleton() {
  return (
    <div className="panel animate-pulse">
      <div className="h-2.5 bg-surface2 rounded mb-3 w-1/3" />
      <div className="h-4 bg-surface2 rounded mb-2" />
      <div className="h-4 bg-surface2 rounded mb-4 w-3/4" />
      <div className="flex gap-2">
        <div className="h-11 bg-surface2 rounded flex-1" />
        <div className="h-11 bg-surface2 rounded flex-1" />
      </div>
    </div>
  )
}

function EmptyActive({ intakeUrl, orgSlug }: { intakeUrl: string; orgSlug: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(intakeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 py-12">
      <div className="w-11 h-11 rounded-full bg-surface2 flex items-center justify-center">
        <svg className="w-5 h-5 text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.02 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-text text-sm font-medium mb-1">Ready for calls</p>
        <p className="text-dim text-xs max-w-[220px]">Share your intake link to start receiving voice calls.</p>
      </div>
      <div className="w-full max-w-xs">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-surface2 rounded border border-border">
          <span className="text-[11px] font-mono text-muted truncate flex-1">{intakeUrl}</span>
          <button
            onClick={copy}
            className="shrink-0 text-[11px] text-blue hover:text-text transition-colors cursor-pointer px-2 py-1 rounded hover:bg-surface min-h-[32px]"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <a href={`/intake/${orgSlug}`} className="mt-1.5 block text-center text-[11px] text-blue hover:underline">
          Open intake →
        </a>
      </div>
      <div className="flex flex-wrap justify-center gap-1 mt-1">
        {STAGES.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className="stage-badge">{s}</span>
            {i < STAGES.length - 1 && <span className="text-dim text-[10px]">→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function DashboardContent({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const intakeUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/intake/${orgSlug}`
    : `https://app.arkops.io/intake/${orgSlug}`

  const { activeCalls, pendingCalls, loading, error, refetch } = useCalls(orgSlug !== 'demo' ? orgSlug : null)
  const [fading, setFading] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyIntake = () => {
    navigator.clipboard.writeText(intakeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleApprove = async (id: string) => {
    setFading(id)
    try {
      await fetch(APPROVE_URL(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', reviewer_note: '' }),
      })
    } catch { /* offline */ }
    setTimeout(() => { setFading(null); refetch() }, 500)
  }

  const handleReject = async (id: string) => {
    setFading(id)
    try {
      await fetch(APPROVE_URL(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reviewer_note: '' }),
      })
    } catch { /* offline */ }
    setTimeout(() => { setFading(null); refetch() }, 350)
  }

  const totalCount = activeCalls.length + pendingCalls.length

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 border-b border-border/70 flex items-center justify-between shrink-0" style={{ background: 'rgba(17,24,39,0.5)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-text font-semibold tracking-tight">Call Queue</h1>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-mono font-bold border border-accent/30">
              {totalCount}
            </span>
          )}
          {error && (
            <span className="text-[11px] text-red/80 font-mono">⚠ {error}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red' : 'bg-green animate-pulse'}`} />
            {error ? 'Offline' : 'Live'}
          </span>
          <button
            onClick={copyIntake}
            className="flex items-center gap-1.5 px-3 py-2 rounded border border-border text-xs text-muted hover:border-border-strong hover:text-text transition-colors cursor-pointer min-h-[36px]"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {copied ? 'Copied!' : 'Intake link'}
          </button>
        </div>
      </header>

      {/* Two-column board */}
      <div className="flex-1 flex gap-px bg-border overflow-hidden">

        {/* In Progress */}
        <section className="flex-1 bg-bg flex flex-col min-w-0">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">In Progress</span>
            <span className="px-1.5 py-0.5 rounded bg-surface2 text-dim text-xs font-mono">{activeCalls.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {loading
              ? [1, 2].map(i => <Skeleton key={i} />)
              : activeCalls.length === 0
                ? <EmptyActive intakeUrl={intakeUrl} orgSlug={orgSlug} />
                : activeCalls.map(c => <ActiveCallCard key={c.id} call={c} />)
            }
          </div>
        </section>

        {/* Pending Approval */}
        <section className="flex-1 bg-bg flex flex-col min-w-0">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Pending Approval</span>
            <span className="px-1.5 py-0.5 rounded bg-surface2 text-dim text-xs font-mono">{pendingCalls.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {loading
              ? [1].map(i => <Skeleton key={i} />)
              : pendingCalls.length === 0
                ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-dim text-xs">No pending approvals</p>
                  </div>
                )
                : pendingCalls.map(call => (
                  <div
                    key={call.id}
                    className="transition-all duration-300"
                    style={{
                      opacity: fading === call.id ? 0 : 1,
                      transform: fading === call.id ? 'scale(0.97)' : 'scale(1)',
                    }}
                  >
                    <CallCard
                      call={call}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onClick={id => router.push(`/dashboard/calls/${id}`)}
                    />
                  </div>
                ))
            }
          </div>
        </section>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <DynOrgProvider>
      {(slug) => <DashboardContent orgSlug={slug} />}
    </DynOrgProvider>
  )
}
