import Link from 'next/link'

const HAS_CLERK =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'pk_test_placeholder' &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_') ?? false) &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.length ?? 0) > 20

export default async function SignInPage() {
  const logo = (
    <div className="flex items-center gap-2 justify-center mb-8">
      <div className="w-8 h-8 rounded-lg bg-blue flex items-center justify-center">
        <svg className="w-4 h-4 text-bg" viewBox="0 0 24 24" fill="currentColor">
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
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {logo}
          <div className="panel text-center">
            <p className="text-text font-semibold mb-2">Dev mode — auth not configured</p>
            <p className="text-muted text-sm mb-5">
              Add real Clerk keys to <code className="font-mono text-xs bg-surface2 px-1 py-0.5 rounded">.env.local</code> to enable sign-in.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-bg rounded-md font-semibold text-sm hover:bg-blue/90 transition-colors"
            >
              Enter dashboard (dev)
            </Link>
            <p className="mt-4 text-dim text-xs">
              Run <code className="font-mono">! npx clerk@latest init</code> to set up auth.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { SignIn } = await import('@clerk/nextjs')
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {logo}
        <SignIn
          appearance={{
            variables: {
              colorPrimary: '#3B82F6',
              colorBackground: '#111827',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              borderRadius: '8px',
            },
            elements: {
              card: 'bg-surface border border-border shadow-xl',
              headerTitle: 'text-text font-bold',
              headerSubtitle: 'text-muted',
            },
          }}
        />
      </div>
    </div>
  )
}
