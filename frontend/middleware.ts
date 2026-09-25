import { NextResponse, type NextRequest } from 'next/server'

// Protected paths that require auth — guarded here when Clerk keys are absent,
// and by clerkMiddleware (in a Clerk-enabled deployment) when keys are present.
const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/calls']

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  if (isProtected) {
    // Redirect to sign-in when no auth provider is configured
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
