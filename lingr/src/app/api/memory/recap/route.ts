import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, createServerSupabaseClient } from '@/lib/db/supabase'
import { getActiveUserPartner, getVocabulary } from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userPartner = await getActiveUserPartner(user.id)
    if (!userPartner) return NextResponse.json({ error: 'No partner' }, { status: 404 })

    const supabase = await createServerSupabaseClient()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Get this week's messages
    const { data: weekMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('user_partner_id', userPartner.id)
      .gte('created_at', weekAgo)

    const userMessages = (weekMessages || []).filter(m => m.role === 'user')

    // Get new vocabulary this week
    const { data: newVocab } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('user_partner_id', userPartner.id)
      .gte('saved_at', weekAgo)

    // Detect topics (simple keyword extraction)
    const allText = userMessages.map(m => m.content).join(' ')
    const topics = extractTopics(allText)

    const recap = {
      week_start: weekAgo,
      messages_sent: userMessages.length,
      new_words_count: newVocab?.length || 0,
      new_words: newVocab || [],
      conversation_topics: topics,
      streak_days: userPartner.streak_count,
      level_progress: userPartner.user_level_estimate,
    }

    return NextResponse.json({ success: true, recap })
  } catch (error) {
    console.error('[Recap] Error:', error)
    return NextResponse.json({ error: 'Failed to generate recap' }, { status: 500 })
  }
}

function extractTopics(text: string): string[] {
  // Simple topic extraction — in production use NLP
  const topicKeywords = [
    'work', 'family', 'food', 'music', 'travel', 'film', 'book',
    'weather', 'weekend', 'holiday', 'love', 'friendship', 'study',
  ]
  return topicKeywords.filter(topic =>
    text.toLowerCase().includes(topic)
  ).slice(0, 5)
}
