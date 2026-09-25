'use client'

import { OrganizationSwitcher, UserButton, useOrganization } from '@clerk/nextjs'

export function ClerkOrgSwitcher() {
  return (
    <OrganizationSwitcher
      hidePersonal
      afterCreateOrganizationUrl="/dashboard"
      afterSelectOrganizationUrl="/dashboard"
      appearance={{
        variables: {
          colorPrimary: '#3B82F6',
          colorBackground: '#1F2937',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        },
        elements: {
          rootBox: 'w-full',
          organizationSwitcherTrigger: 'w-full px-2 py-2 rounded-md hover:bg-surface2 text-text text-sm',
        },
      }}
    />
  )
}

export function ClerkUserButton() {
  const { organization } = useOrganization()
  return (
    <>
      <UserButton
        appearance={{
          variables: { colorPrimary: '#3B82F6', fontFamily: 'Plus Jakarta Sans, sans-serif' },
        }}
      />
      <span className="text-xs text-muted truncate">{organization?.name ?? 'Personal'}</span>
    </>
  )
}

export function ClerkOrgSlug({ children }: { children: (slug: string) => React.ReactNode }) {
  const { organization } = useOrganization()
  return <>{children(organization?.slug ?? 'demo')}</>
}
