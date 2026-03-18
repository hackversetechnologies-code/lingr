import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/db/supabase'
import { getActiveUserPartner, getVocabulary } from '@/lib/db/queries'
import { VocabNotebook } from '@/components/vocab/VocabNotebook'
import { BottomNav } from '@/components/layout/BottomNav'

export default async function VocabPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const userPartner = await getActiveUserPartner(user.id)
  if (!userPartner) redirect('/onboarding')

  const vocabulary = await getVocabulary(userPartner.id)

  return (
    <div className="flex flex-col h-screen bg-[#F5F0EB]">
      <div className="flex-1 overflow-y-auto">
        <VocabNotebook
          vocabulary={vocabulary}
          partnerName={userPartner.partner.name}
          languageName={userPartner.partner.language_name}
        />
      </div>
      <BottomNav active="vocab" />
    </div>
  )
}
