'use client'

import { useRouter } from 'next/navigation'
import CategoryBadge from '@/components/CategoryBadge'

const HISTORY = [
  { id: 'call-h1', category: 'urgent',   urgency: 'critical', status: 'approved', created_at: new Date(Date.now() - 3600000).toISOString(),  summary: 'Emergency AC dispatch — 2847 Westbrook Ave, Unit 4B' },
  { id: 'call-h2', category: 'standard', urgency: 'medium',   status: 'approved', created_at: new Date(Date.now() - 7200000).toISOString(),  summary: 'Routine HVAC maintenance — 142 Pine Street' },
  { id: 'call-h3', category: 'defer',    urgency: 'low',      status: 'rejected', created_at: new Date(Date.now() - 18000000).toISOString(), summary: 'Thermostat query — no action required' },
]

const STATUS_STYLES: Record<string, string> = {
  approved: 'text-green bg-green/10 border-green/20',
  rejected: 'text-red bg-red/10 border-red/20',
  executed: 'text-blue bg-blue/10 border-blue/20',
}

export default function CallHistoryPage() {
  const router = useRouter()

  return (
    <div className="flex-1 flex flex-col" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <header className="px-8 py-5 border-b border-border shrink-0">
        <h1 className="text-text font-semibold">Call History</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="text-[10px] font-mono text-dim uppercase tracking-widest text-left">
              <th className="pb-3 pr-6 font-medium">Time</th>
              <th className="pb-3 pr-6 font-medium">Category</th>
              <th className="pb-3 pr-6 font-medium">Summary</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {HISTORY.map(call => (
              <tr
                key={call.id}
                className="hover:bg-surface transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/calls/${call.id}`)}
                onKeyDown={e => e.key === 'Enter' && router.push(`/dashboard/calls/${call.id}`)}
                tabIndex={0}
                role="row"
              >
                <td className="py-3 pr-6 text-dim font-mono text-xs whitespace-nowrap">
                  {new Date(call.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-3 pr-6"><CategoryBadge category={call.category} /></td>
                <td className="py-3 pr-6 text-muted max-w-sm truncate">{call.summary}</td>
                <td className="py-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${STATUS_STYLES[call.status] ?? 'text-muted bg-surface2 border-border'}`}>
                    {call.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
