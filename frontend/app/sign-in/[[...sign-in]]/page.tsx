import Link from 'next/link'

const HAS_CLERK =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'pk_test_placeholder' &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_') ?? false) &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.length ?? 0) > 20

const clerkAppearance = {
  variables: {
    colorPrimary: '#3B82F6',
    colorBackground: '#111827',
    colorInputBackground: '#1F2937',
    colorInputText: '#F1F5F9',
    colorText: '#F1F5F9',
    colorTextSecondary: '#94A3B8',
    colorNeutral: '#374151',
    colorDanger: '#EF4444',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    borderRadius: '10px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
  elements: {
    card: {
      background: '#111827',
      border: '1px solid #374151',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
      borderRadius: '12px',
    },
    headerTitle: { color: '#F1F5F9', fontWeight: '700' },
    headerSubtitle: { color: '#94A3B8' },
    formFieldLabel: { color: '#94A3B8' },
    formFieldInput: {
      background: '#1F2937',
      border: '1px solid #374151',
      color: '#F1F5F9',
      borderRadius: '8px',
    },
    formFieldInput__focus: { borderColor: '#3B82F6' },
    dividerLine: { background: '#374151' },
    dividerText: { color: '#475569' },
    socialButtonsBlockButton: {
      background: '#1F2937',
      border: '1px solid #374151',
      color: '#F1F5F9',
      borderRadius: '8px',
    },
    socialButtonsBlockButton__hover: { background: '#374151' },
    footerActionLink: { color: '#3B82F6' },
    footerActionText: { color: '#94A3B8' },
    identityPreviewText: { color: '#F1F5F9' },
    identityPreviewEditButton: { color: '#3B82F6' },
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
      color: '#fff',
      fontWeight: '600',
      borderRadius: '8px',
    },
    otpCodeFieldInput: {
      background: '#1F2937',
      border: '1px solid #374151',
      color: '#F1F5F9',
    },
  },
} as const

export default async function SignInPage() {
  const logo = (
    <div className="flex items-center gap-2 justify-center mb-8">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}
      >
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <span className="text-text font-bold text-xl tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        ArkOps
      </span>
    </div>
  )

  if (!HAS_CLERK) {
    return (
      <div
        className="min-h-screen bg-bg flex items-center justify-center px-4"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(59,130,246,0.08) 0%, transparent 65%)',
        }}
      >
        <div className="w-full max-w-md">
          {logo}
          <div className="panel text-center">
            <p className="text-text font-semibold mb-2">Dev mode — auth not configured</p>
            <p className="text-muted text-sm mb-5">
              Add real Clerk keys to{' '}
              <code className="font-mono text-xs bg-surface2 px-1 py-0.5 rounded">.env.local</code> to enable sign-in.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            >
              Enter dashboard (dev)
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { SignIn } = await import('@clerk/nextjs')
  return (
    <div
      className="min-h-screen bg-bg flex items-center justify-center px-4"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(59,130,246,0.07) 0%, transparent 65%)',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}
    >
      <div className="w-full max-w-md">
        {logo}
        <SignIn
          fallbackRedirectUrl="/dashboard"
          appearance={clerkAppearance}
        />
        <p className="text-center text-xs text-dim mt-5">
          No account?{' '}
          <Link href="/sign-up" className="text-blue hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}
