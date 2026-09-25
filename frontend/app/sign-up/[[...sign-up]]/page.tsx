import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg className="w-4 h-4 text-bg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-text font-bold text-xl tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            ArkOps
          </span>
        </div>
        <SignUp
          appearance={{
            variables: {
              colorPrimary: '#2563EB',
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
