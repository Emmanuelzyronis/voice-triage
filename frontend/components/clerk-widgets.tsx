'use client'

import { OrganizationSwitcher, UserButton, useOrganization } from '@clerk/nextjs'

const switcherAppearance = {
  variables: {
    colorPrimary: '#3B82F6',
    colorBackground: '#1F2937',
    colorText: '#F1F5F9',
    colorTextSecondary: '#94A3B8',
    colorNeutral: '#374151',
    colorInputBackground: '#111827',
    colorInputText: '#F1F5F9',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    borderRadius: '8px',
  },
  elements: {
    rootBox: { width: '100%' },
    organizationSwitcherTrigger: {
      width: '100%',
      padding: '8px 10px',
      borderRadius: '8px',
      color: '#F1F5F9',
      background: 'transparent',
    },
    organizationSwitcherTrigger__open: { background: 'rgba(59,130,246,0.08)' },
    organizationSwitcherPopoverCard: {
      background: '#1F2937',
      border: '1px solid #374151',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      borderRadius: '10px',
    },
    organizationPreviewMainIdentifier: { color: '#F1F5F9' },
    organizationPreviewSecondaryIdentifier: { color: '#94A3B8' },
    organizationListItemButton: { color: '#F1F5F9' },
    organizationListItemButton__active: { background: 'rgba(59,130,246,0.1)' },
    createOrganizationButtonText: { color: '#3B82F6' },
    popoverFooter: { borderColor: '#374151' },
  },
} as const

export function ClerkOrgSwitcher() {
  return (
    <OrganizationSwitcher
      afterCreateOrganizationUrl="/dashboard"
      afterSelectOrganizationUrl="/dashboard"
      afterSelectPersonalUrl="/dashboard"
      appearance={switcherAppearance}
    />
  )
}

export function ClerkUserButton() {
  const { organization } = useOrganization()
  return (
    <>
      <UserButton
        appearance={{
          variables: {
            colorPrimary: '#3B82F6',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          },
        }}
      />
      <span className="text-xs text-muted truncate">{organization?.name ?? 'Personal workspace'}</span>
    </>
  )
}

export function ClerkOrgSlug({ children }: { children: (slug: string) => React.ReactNode }) {
  const { organization } = useOrganization()
  return <>{children(organization?.slug ?? 'demo')}</>
}
