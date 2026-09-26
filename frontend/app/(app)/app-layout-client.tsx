'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Call History',
    href: '/dashboard/calls',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.02 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
      </svg>
    ),
  },
  {
    label: 'Configure',
    href: '/admin',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: 'Integrations',
    href: '/admin/integrations',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
]

function OrgFallback() {
  return (
    <div className="px-3 py-2 text-xs text-muted rounded-lg border border-border bg-surface2">
      Demo workspace
    </div>
  )
}

function UserFallback() {
  return (
    <>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
      >
        D
      </div>
      <span className="text-xs text-muted truncate">Dispatcher</span>
    </>
  )
}

const DynOrgSwitcher = dynamic(
  () => import('@/components/clerk-widgets').then(m => m.ClerkOrgSwitcher),
  { ssr: false, loading: () => <OrgFallback /> }
)

const DynUserButton = dynamic(
  () => import('@/components/clerk-widgets').then(m => m.ClerkUserButton),
  { ssr: false, loading: () => <UserFallback /> }
)

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div
      className="flex h-screen bg-bg overflow-hidden"
      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="w-60 shrink-0 flex flex-col border-r border-border/70"
        style={{ background: 'rgba(17,24,39,0.95)', backdropFilter: 'blur(12px)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}
            >
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-sm text-text tracking-tight">ArkOps</span>
            <span
              className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              Beta
            </span>
          </div>
        </div>

        {/* Org switcher */}
        <div className="px-3 py-3 border-b border-border/60">
          <DynOrgSwitcher />
        </div>

        {/* Nav section label */}
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-dim">Workspace</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5">
          {NAV.map(({ label, href, icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer relative ${
                  active
                    ? 'text-text'
                    : 'text-muted hover:text-text hover:bg-white/[0.04]'
                }`}
                style={
                  active
                    ? {
                        background: 'rgba(59,130,246,0.1)',
                        borderLeft: '2px solid #3B82F6',
                        paddingLeft: '10px',
                      }
                    : undefined
                }
              >
                <span className={active ? 'text-blue' : 'text-muted'}>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-border/60 flex items-center gap-3">
          <DynUserButton />
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  )
}
