import { clerkMiddleware } from '@clerk/nextjs/server'

// Auth protection moved to individual pages/layouts per Clerk v7 recommendation
// (createRouteMatcher is deprecated in favor of resource-based auth)
export default clerkMiddleware()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
