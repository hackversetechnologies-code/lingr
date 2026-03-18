import { redirect } from 'next/navigation'
import { getServerUser, getServerUserProfile } from '@/lib/db/supabase'
import { getActiveUserPartner } from '@/lib/db/queries'

export default async function HomePage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getServerUserProfile()
  if (!profile?.onboarding_complete) {
    redirect('/onboarding')
  }

  const userPartner = await getActiveUserPartner(user.id)
  if (!userPartner) {
    redirect('/onboarding')
  }

  redirect('/chat')
}
