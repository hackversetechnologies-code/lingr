import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/db/supabase'
import { getActiveUserPartner, getRecentMessages } from '@/lib/db/queries'
import ChatInterface from '@/components/chat/ChatInterface'
import { BottomNav } from '@/components/layout/BottomNav'

export default async function ChatPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const userPartner = await getActiveUserPartner(user.id)
  if (!userPartner) redirect('/onboarding')

  const messages = await getRecentMessages(userPartner.id, 50)

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          initialMessages={messages}
          userPartner={userPartner}
          userId={user.id}
        />
      </div>
      <BottomNav active="chat" />
    </div>
  )
}
