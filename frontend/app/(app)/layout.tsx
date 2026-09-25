import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AppLayoutClient from './app-layout-client'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return <AppLayoutClient>{children}</AppLayoutClient>
}
