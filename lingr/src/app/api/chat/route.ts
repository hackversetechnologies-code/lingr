import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/db/supabase'
import {
  getRecentMessages,
  saveMessage,
  getUserPartnerWithDetails,
  checkDailyLimit,
  updateUserPartner,
  searchSimilarMemories,
  getActiveUserPartner,
} from '@/lib/db/queries'
import { generatePartnerResponse, generateEmbedding } from '@/lib/ai'
import { generateSpeech } from '@/lib/tts'
import { processMemoriesForUserPartner, shouldProcessMemories, extractAndUpdateKnownFacts, detectLevelProgress } from '@/lib/memory'
import { createAdminClient } from '@/lib/db/supabase'
import type { ConversationContext } from '@/types'

// ============================================
// POST /api/chat — Send a message
// ============================================

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content, userPartnerId, source = 'pwa' } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 })
    }

    // Get user partner relationship
    const userPartner = userPartnerId
      ? await getUserPartnerWithDetails(user.id, userPartnerId)
      : await getActiveUserPartner(user.id)

    if (!userPartner) {
      return NextResponse.json({ error: 'No partner found' }, { status: 404 })
    }

    // Check daily message limit
    const limitCheck = await checkDailyLimit(user.id, userPartner.id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Daily message limit reached',
          remaining: 0,
          tier: limitCheck.tier,
          upgrade_url: '/settings/upgrade',
        },
        { status: 429 }
      )
    }

    // Check if partner can send voice (Plus/Pro only)
    const canSendVoice = limitCheck.tier !== 'free'

    // Save user message
    const userMessage = await saveMessage({
      user_partner_id: userPartner.id,
      role: 'user',
      content: content.trim(),
      language: detectMessageLanguage(content, userPartner.partner.language_code),
      has_audio: false,
      corrections: [],
      flagged_words: [],
      source: source as 'pwa' | 'telegram',
      is_read: true,
    })

    // Get recent messages for context
    const recentMessages = await getRecentMessages(userPartner.id, 20)

    // Get semantic memories relevant to this message
    let injectedMemories: import('@/types').Memory[] = []
    try {
      const queryEmbedding = await generateEmbedding(content)
      injectedMemories = await searchSimilarMemories(userPartner.id, queryEmbedding, 10)
    } catch {
      // Memory search is non-critical
    }

    // Build conversation context
    const ctx: ConversationContext = {
      partner: userPartner.partner,
      userPartner,
      recentMessages,
      injectedMemories,
      userLevel: userPartner.user_level_estimate,
      currentMood: userPartner.current_mood as import('@/types').MoodState,
      correctionStyle: 'gentle',
      insideJokes: userPartner.inside_jokes || [],
      knownFacts: userPartner.known_facts || [],
    }

    // Generate AI response
    const aiResponse = await generatePartnerResponse(ctx, recentMessages)

    // Handle voice note generation
    let audioUrl: string | undefined
    let audioDuration: number | undefined

    if (aiResponse.shouldSendVoice && canSendVoice) {
      try {
        const ttsResult = await generateSpeech(
          aiResponse.content,
          userPartner.partner.voice_id,
          userPartner.partner.gender as 'female' | 'male' | 'nonbinary'
        )

        // Upload to Supabase Storage
        const admin = createAdminClient()
        const filename = `${userPartner.id}/${Date.now()}.mp3`
        const { data: uploadData } = await admin.storage
          .from(process.env.SUPABASE_STORAGE_BUCKET_AUDIO || 'lingr-audio')
          .upload(filename, ttsResult.audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: false,
          })

        if (uploadData) {
          const { data: urlData } = admin.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET_AUDIO || 'lingr-audio')
            .getPublicUrl(filename)
          audioUrl = urlData.publicUrl
          audioDuration = ttsResult.duration
        }
      } catch (err) {
        console.error('[Chat] TTS failed, sending text only:', err)
      }
    }

    // Save partner response
    const partnerMessage = await saveMessage({
      user_partner_id: userPartner.id,
      role: 'assistant',
      content: aiResponse.content,
      language: 'target',
      has_audio: !!audioUrl,
      audio_url: audioUrl,
      audio_duration: audioDuration,
      corrections: aiResponse.corrections || [],
      flagged_words: [],
      source: source as 'pwa' | 'telegram',
      is_read: false,
    })

    // Background tasks (non-blocking)
    Promise.all([
      // Extract known facts from user message
      extractAndUpdateKnownFacts(userPartner.id, content),

      // Process memories if threshold reached
      shouldProcessMemories(userPartner.id).then(should => {
        if (should) {
          processMemoriesForUserPartner(userPartner.id, recentMessages)
        }
      }),

      // Check for level up
      detectLevelProgress(userPartner.id, userPartner.total_messages + 2).then(async shouldLevelUp => {
        if (shouldLevelUp) {
          // Trigger a special message about level progress
          console.log(`[Chat] User ${user.id} reached a milestone!`)
        }
      }),

      // Update partner mood daily
      updateMoodIfNeeded(userPartner.id, userPartner.mood_updated_at),
    ]).catch(err => console.error('[Chat] Background task error:', err))

    return NextResponse.json({
      success: true,
      userMessage,
      partnerMessage,
      remaining: limitCheck.remaining - 1,
      provider: aiResponse.provider,
    })
  } catch (error) {
    console.error('[Chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}

// ============================================
// GET /api/chat — Get message history
// ============================================

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const userPartnerId = searchParams.get('userPartnerId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') || undefined

    const userPartner = userPartnerId
      ? await getUserPartnerWithDetails(user.id, userPartnerId)
      : await getActiveUserPartner(user.id)

    if (!userPartner) return NextResponse.json({ error: 'No partner found' }, { status: 404 })

    const { getMessageHistory } = await import('@/lib/db/queries')
    const messages = await getMessageHistory(userPartner.id, limit, before)

    return NextResponse.json({ success: true, messages, userPartner })
  } catch (error) {
    console.error('[Chat] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// ============================================
// HELPERS
// ============================================

function detectMessageLanguage(content: string, targetLangCode: string): 'target' | 'native' | 'mixed' {
  // Simple heuristic — in production use a language detection library
  const latinScript = /^[a-zA-Z\s.,!?'"()-]+$/.test(content)
  const hasNonLatin = /[^\x00-\x7F]/.test(content)

  if (['ja', 'ko', 'zh', 'ru'].includes(targetLangCode)) {
    if (hasNonLatin && latinScript) return 'mixed'
    if (hasNonLatin) return 'target'
    return 'native' // Latin chars for non-latin language = likely native
  }

  return 'target' // Default for Latin-script languages
}

async function updateMoodIfNeeded(userPartnerId: string, moodUpdatedAt: string) {
  const lastUpdate = new Date(moodUpdatedAt)
  const now = new Date()
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60)

  if (hoursSinceUpdate >= 20) {
    const { selectDailyMood } = await import('@/lib/ai')
    const admin = createAdminClient()
    await admin
      .from('user_partners')
      .update({
        current_mood: selectDailyMood(),
        mood_updated_at: now.toISOString(),
      })
      .eq('id', userPartnerId)
  }
}
