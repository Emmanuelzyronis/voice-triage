import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ArkOps',
  description: 'Voice-driven operational triage platform',
}

// ClerkProvider is loaded lazily so placeholder keys don't crash the app
async function MaybeClerkProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const isValidKey = key.startsWith('pk_') && key !== 'pk_test_placeholder' && key.length > 20

  if (!isValidKey) return <>{children}</>

  const { ClerkProvider } = await import('@clerk/nextjs')
  return <ClerkProvider>{children}</ClerkProvider>
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <MaybeClerkProvider>
      <html lang="en" className="h-full antialiased">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="min-h-full bg-bg text-text font-sans">{children}</body>
      </html>
    </MaybeClerkProvider>
  )
}
