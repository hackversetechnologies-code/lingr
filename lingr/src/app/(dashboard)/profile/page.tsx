import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/db/supabase'
import { getActiveUserPartner } from '@/lib/db/queries'
import { PartnerProfileClient } from '@/components/vocab/PartnerProfile'
import { BottomNav } from '@/components/layout/BottomNav'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { format, differenceInDays, parseISO } from 'date-fns'

export default async function ProfilePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const userPartner = await getActiveUserPartner(user.id)
  if (!userPartner) redirect('/onboarding')

  // Get vocab stats
  const supabase = await createServerSupabaseClient()
  const { count: totalVocab } = await supabase
    .from('vocabulary')
    .select('*', { count: 'exact', head: true })
    .eq('user_partner_id', userPartner.id)

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: weekVocab } = await supabase
    .from('vocabulary')
    .select('*', { count: 'exact', head: true })
    .eq('user_partner_id', userPartner.id)
    .gte('saved_at', weekAgo)

  const daysTogether = differenceInDays(new Date(), parseISO(userPartner.started_at))

  return (
    <div className="flex flex-col h-screen bg-[#F5F0EB]">
      <div className="flex-1 overflow-y-auto">
        <PartnerProfileClient
          userPartner={userPartner}
          stats={{
            daysTogether,
            streak: userPartner.streak_count,
            totalMessages: userPartner.total_messages,
            totalVocab: totalVocab || 0,
            weekVocab: weekVocab || 0,
            level: userPartner.user_level_estimate,
          }}
        />
      </div>
      <BottomNav active="profile" />
    </div>
  )
}
