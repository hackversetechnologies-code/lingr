import { createAdminClient, createServerSupabaseClient } from './supabase'
import type { Message, UserPartner, VocabularyEntry, Memory } from '@/types'

// ============================================
// USER PARTNER QUERIES
// ============================================

export async function getUserPartnerWithDetails(userId: string, userPartnerId?: string) {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('user_partners')
    .select(`
      *,
      partner:partners(*)
    `)
    .eq('user_id', userId)

  if (userPartnerId) {
    query = query.eq('id', userPartnerId)
  }

  const { data, error } = await query.single()
  if (error) return null
  return data as UserPartner
}

export async function getUserPartners(userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('user_partners')
    .select(`*, partner:partners(*)`)
    .eq('user_id', userId)
    .order('last_chat_date', { ascending: false })
  return data || []
}

export async function getActiveUserPartner(userId: string): Promise<UserPartner | null> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('user_partners')
    .select(`*, partner:partners(*)`)
    .eq('user_id', userId)
    .order('last_chat_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()
  return data as UserPartner | null
}

export async function updateUserPartner(
  userPartnerId: string,
  updates: Partial<UserPartner>
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_partners')
    .update(updates)
    .eq('id', userPartnerId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStreak(userPartnerId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin.rpc('update_streak', {
    p_user_partner_id: userPartnerId,
  })
  return data as number
}

// ============================================
// MESSAGE QUERIES
// ============================================

export async function getRecentMessages(
  userPartnerId: string,
  limit = 20
): Promise<Message[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('user_partner_id', userPartnerId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data || []).reverse()) as Message[]
}

export async function getMessageHistory(
  userPartnerId: string,
  limit = 50,
  before?: string
) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('messages')
    .select('*')
    .eq('user_partner_id', userPartnerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data } = await query
  return ((data || []).reverse()) as Message[]
}

export async function saveMessage(message: Omit<Message, 'id' | 'created_at'>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('messages')
    .insert(message)
    .select()
    .single()
  if (error) throw error

  // Increment message counts
  await admin.rpc('update_streak', { p_user_partner_id: message.user_partner_id })
  await admin
    .from('user_partners')
    .update({
      total_messages: admin.rpc('increment', { x: 1 }),
      messages_today: admin.rpc('increment', { x: 1 }),
    })
    .eq('id', message.user_partner_id)

  return data as Message
}

// ============================================
// VOCABULARY QUERIES
// ============================================

export async function saveVocabularyWord(entry: Omit<VocabularyEntry, 'id' | 'saved_at'>) {
  const admin = createAdminClient()

  // Check if word already exists, if so increment times_seen
  const { data: existing } = await admin
    .from('vocabulary')
    .select('id, times_seen')
    .eq('user_partner_id', entry.user_partner_id)
    .eq('word', entry.word)
    .single()

  if (existing) {
    const { data } = await admin
      .from('vocabulary')
      .update({ times_seen: existing.times_seen + 1 })
      .eq('id', existing.id)
      .select()
      .single()
    return data
  }

  const { data, error } = await admin
    .from('vocabulary')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getVocabulary(userPartnerId: string, userSavedOnly = false) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('vocabulary')
    .select('*')
    .eq('user_partner_id', userPartnerId)
    .order('saved_at', { ascending: false })

  if (userSavedOnly) {
    query = query.eq('user_saved', true)
  }

  const { data } = await query
  return (data || []) as VocabularyEntry[]
}

// ============================================
// MEMORY QUERIES
// ============================================

export async function saveMemory(memory: Omit<Memory, 'id' | 'created_at'>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('memories')
    .insert(memory)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function searchSimilarMemories(
  userPartnerId: string,
  queryEmbedding: number[],
  limit = 10
): Promise<Memory[]> {
  const admin = createAdminClient()
  const { data } = await admin.rpc('search_memories', {
    p_user_partner_id: userPartnerId,
    p_query_embedding: queryEmbedding,
    p_limit: limit,
  })
  return (data || []) as Memory[]
}

// ============================================
// RELATIONSHIP EVENT QUERIES
// ============================================

export async function logRelationshipEvent(
  userPartnerId: string,
  eventType: string,
  eventData: Record<string, unknown> = {}
) {
  const admin = createAdminClient()
  await admin.from('relationship_events').insert({
    user_partner_id: userPartnerId,
    event_type: eventType,
    event_data: eventData,
  })
}

// ============================================
// DAILY LIMIT CHECK
// ============================================

export async function checkDailyLimit(userId: string, userPartnerId: string): Promise<{
  allowed: boolean
  remaining: number
  tier: string
}> {
  const admin = createAdminClient()

  const { data: user } = await admin
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .single()

  const { data: up } = await admin
    .from('user_partners')
    .select('messages_today, messages_today_reset')
    .eq('id', userPartnerId)
    .single()

  if (!user || !up) return { allowed: false, remaining: 0, tier: 'free' }

  // Reset if new day
  if (up.messages_today_reset !== new Date().toISOString().split('T')[0]) {
    await admin
      .from('user_partners')
      .update({ messages_today: 0, messages_today_reset: new Date().toISOString().split('T')[0] })
      .eq('id', userPartnerId)
    up.messages_today = 0
  }

  const limits: Record<string, number> = { free: 20, plus: 999999, pro: 999999 }
  const limit = limits[user.subscription_tier] || 20
  const remaining = Math.max(0, limit - up.messages_today)

  return {
    allowed: remaining > 0,
    remaining,
    tier: user.subscription_tier,
  }
}
