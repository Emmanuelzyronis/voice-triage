'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OrganizationSwitcher, UserButton, useOrganization } from '@clerk/nextjs'

const NAV = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Call History',
    href: '/dashboard/calls',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.02 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
      </svg>
    ),
  },
  {
    label: 'Configure',
    href: '/admin',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93A10 10 0 1118 18" />
        <path d="M12 8V4M12 20v-4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4 12H8M16 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    label: 'Integrations',
    href: '/admin/integrations',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { organization } = useOrganization()

  return (
    <div className="flex h-screen bg-bg overflow-hidden" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-border bg-surface">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-bg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-sm text-text tracking-tight">ArkOps</span>
          </div>
        </div>

        {/* Org switcher */}
        <div className="px-3 py-3 border-b border-border">
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              variables: {
                colorPrimary: '#2563EB',
                colorBackground: '#1F2937',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              },
              elements: {
                rootBox: 'w-full',
                organizationSwitcherTrigger: 'w-full px-2 py-2 rounded-md hover:bg-surface2 text-text text-sm',
              },
            }}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
          {NAV.map(({ label, href, icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue text-bg'
                    : 'text-muted hover:bg-surface2 hover:text-text'
                }`}
              >
                {icon}
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-border flex items-center gap-3">
          <UserButton
            appearance={{
              variables: {
                colorPrimary: '#2563EB',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              },
            }}
          />
          <span className="text-xs text-muted truncate">
            {organization?.name ?? 'Personal'}
          </span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  )
}
