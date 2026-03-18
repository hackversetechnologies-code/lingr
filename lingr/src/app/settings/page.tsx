import { redirect } from 'next/navigation'
import { getServerUser, createAdminClient } from '@/lib/db/supabase'
import { SettingsClient } from '@/components/layout/SettingsClient'

export default async function SettingsPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <SettingsClient
      user={{ id: user.id, email: user.email || '', ...profile }}
    />
  )
}
