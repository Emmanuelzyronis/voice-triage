import { NextResponse, type NextRequest } from 'next/server'

const HAS_CLERK =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'pk_test_placeholder' &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_') ?? false) &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.length ?? 0) > 20

// Protected paths — only enforced when Clerk is configured.
// Without keys, all routes are accessible for local development.
const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/calls']

export default function middleware(req: NextRequest) {
  if (!HAS_CLERK) return NextResponse.next()

  const { pathname } = req.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  if (isProtected) {
    // With Clerk keys configured, clerkMiddleware (added back to this file) handles auth.
    // This fallback redirect covers the transition period.
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
