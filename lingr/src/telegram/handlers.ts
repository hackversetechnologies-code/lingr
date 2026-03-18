/**
 * Telegram Bot Handlers
 * grammY-based bot that mirrors the PWA chat experience
 */

import type { Bot, Context } from 'grammy'
import { createAdminClient } from '@/lib/db/supabase'
import { getActiveUserPartner, getRecentMessages, getUserPartnerWithDetails } from '@/lib/db/queries'
import { generatePartnerResponse, generateEmbedding } from '@/lib/ai'
import { searchSimilarMemories } from '@/lib/db/queries'
import type { ConversationContext } from '@/types'

// Map Telegram chat_id to user_id
async function getTelegramUser(telegramChatId: number) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('telegram_links')
    .select('user_id')
    .eq('telegram_chat_id', telegramChatId)
    .single()
  return data?.user_id || null
}

// Handle incoming Telegram update
export async function handleTelegramUpdate(bot: Bot, update: Record<string, unknown>) {
  const message = (update as { message?: { text?: string; from?: { id: number }; chat?: { id: number }; voice?: { file_id: string; duration: number }; caption?: string } }).message
  if (!message) return

  const chatId = message.chat?.id
  const userId = message.from?.id
  if (!chatId || !userId) return

  const linkedUserId = await getTelegramUser(chatId)

  // Handle commands
  const text = message.text || message.caption || ''

  if (text.startsWith('/start')) {
    await handleStart(bot, chatId, userId, text)
    return
  }

  if (!linkedUserId) {
    await bot.api.sendMessage(chatId, 
      '👋 Link your Lingr account first!\n\nVisit lingr.app and connect your Telegram in settings.'
    )
    return
  }

  if (text.startsWith('/vocab')) {
    await handleVocabCommand(bot, chatId, linkedUserId)
    return
  }

  if (text.startsWith('/streak')) {
    await handleStreakCommand(bot, chatId, linkedUserId)
    return
  }

  if (text.startsWith('/recap')) {
    await handleRecapCommand(bot, chatId, linkedUserId)
    return
  }

  if (text.startsWith('/partner')) {
    await handlePartnerCommand(bot, chatId, linkedUserId)
    return
  }

  if (text.startsWith('/level')) {
    await handleLevelCommand(bot, chatId, linkedUserId)
    return
  }

  if (text.startsWith('/translate ')) {
    const word = text.replace('/translate ', '').trim()
    await handleTranslateCommand(bot, chatId, word, linkedUserId)
    return
  }

  // Handle voice messages
  if (message.voice) {
    await handleVoiceMessage(bot, chatId, message.voice.file_id, linkedUserId)
    return
  }

  // Regular message — send to partner
  if (text) {
    await handleChatMessage(bot, chatId, text, linkedUserId)
  }
}

async function handleStart(bot: Bot, chatId: number, telegramUserId: number, text: string) {
  // Check for magic link token
  const parts = text.split(' ')
  if (parts.length > 1) {
    const token = parts[1]
    // Verify token and link account
    const admin = createAdminClient()
    const { data: linkToken } = await admin
      .from('telegram_link_tokens')
      .select('user_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (linkToken) {
      await admin.from('telegram_links').upsert({
        telegram_chat_id: chatId,
        telegram_user_id: telegramUserId,
        user_id: linkToken.user_id,
        linked_at: new Date().toISOString(),
      })

      await admin.from('telegram_link_tokens')
        .delete()
        .eq('token', token)

      await bot.api.sendMessage(chatId,
        '✅ *Linked!* Your Lingr account is connected.\n\nYou can now chat with your language partner right here. Just send a message!',
        { parse_mode: 'Markdown' }
      )
      return
    }
  }

  await bot.api.sendMessage(chatId,
    `🌿 *Welcome to Lingr*\n\nTo connect your account, go to lingr.app → Settings → Connect Telegram.\n\nYou'll get a link to tap here.`,
    { parse_mode: 'Markdown' }
  )
}

async function handleChatMessage(bot: Bot, chatId: number, text: string, userId: string) {
  const typingAction = bot.api.sendChatAction(chatId, 'typing')

  const userPartner = await getActiveUserPartner(userId)
  if (!userPartner) {
    await bot.api.sendMessage(chatId, 'No partner found. Visit lingr.app to set one up!')
    return
  }

  // Keep typing visible
  await typingAction

  const recentMessages = await getRecentMessages(userPartner.id, 20)

  // Save user message
  const admin = createAdminClient()
  await admin.from('messages').insert({
    user_partner_id: userPartner.id,
    role: 'user',
    content: text,
    language: 'target',
    has_audio: false,
    source: 'telegram',
    is_read: true,
  })

  // Get memories
  let injectedMemories: import('@/types').Memory[] = []
  try {
    const embedding = await generateEmbedding(text)
    injectedMemories = await searchSimilarMemories(userPartner.id, embedding, 10)
  } catch {}

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

  // Keep typing
  setTimeout(() => bot.api.sendChatAction(chatId, 'typing').catch(() => {}), 2000)

  const aiResponse = await generatePartnerResponse(ctx, recentMessages)

  // Save partner response
  await admin.from('messages').insert({
    user_partner_id: userPartner.id,
    role: 'assistant',
    content: aiResponse.content,
    language: 'target',
    has_audio: false,
    source: 'telegram',
    is_read: false,
  })

  // If voice note, send audio
  if (aiResponse.shouldSendVoice) {
    try {
      await bot.api.sendChatAction(chatId, 'record_voice')
      const ttsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/voice/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ text: aiResponse.content, userPartnerId: userPartner.id }),
      })

      if (ttsRes.ok) {
        const ttsData = await ttsRes.json()
        if (ttsData.audioUrl) {
          await bot.api.sendVoice(chatId, ttsData.audioUrl, {
            caption: aiResponse.content.slice(0, 200),
          })
          return
        }
      }
    } catch {}
  }

  await bot.api.sendMessage(chatId, aiResponse.content)
}

async function handleVoiceMessage(bot: Bot, chatId: number, fileId: string, userId: string) {
  await bot.api.sendChatAction(chatId, 'typing')

  try {
    // Get file from Telegram
    const file = await bot.api.getFile(fileId)
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

    // Fetch audio
    const audioRes = await fetch(fileUrl)
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer())

    // Transcribe
    const { transcribeAudio } = await import('@/lib/stt')
    const sttResult = await transcribeAudio(audioBuffer, 'audio/ogg')

    if (sttResult.transcript) {
      await handleChatMessage(bot, chatId, sttResult.transcript, userId)
    } else {
      await bot.api.sendMessage(chatId, "I couldn't quite hear that — could you type it?")
    }
  } catch (err) {
    console.error('[Telegram] Voice error:', err)
    await bot.api.sendMessage(chatId, "Voice message failed to process.")
  }
}

async function handleVocabCommand(bot: Bot, chatId: number, userId: string) {
  const admin = createAdminClient()
  const userPartner = await getActiveUserPartner(userId)
  if (!userPartner) return

  const { data: vocab } = await admin
    .from('vocabulary')
    .select('word, translation, times_seen')
    .eq('user_partner_id', userPartner.id)
    .eq('user_saved', true)
    .order('saved_at', { ascending: false })
    .limit(10)

  if (!vocab?.length) {
    await bot.api.sendMessage(chatId, "📚 No saved words yet. Tap words in the app to save them!")
    return
  }

  const lines = vocab.map(v => `• *${v.word}* — ${v.translation}`).join('\n')
  await bot.api.sendMessage(chatId, `📚 *Your saved words:*\n\n${lines}`, { parse_mode: 'Markdown' })
}

async function handleStreakCommand(bot: Bot, chatId: number, userId: string) {
  const userPartner = await getActiveUserPartner(userId)
  if (!userPartner) return

  const days = Math.floor((Date.now() - new Date(userPartner.started_at).getTime()) / (1000 * 60 * 60 * 24))

  await bot.api.sendMessage(chatId,
    `🔥 *${userPartner.streak_count} day streak* with ${userPartner.partner.name}\n\nDay ${days + 1} together`,
    { parse_mode: 'Markdown' }
  )
}

async function handleRecapCommand(bot: Bot, chatId: number, userId: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/memory/recap`, {
    headers: { 'x-user-id': userId },
  })
  const data = await res.json()

  if (!data.recap) {
    await bot.api.sendMessage(chatId, "No recap yet — chat more first!")
    return
  }

  const { recap } = data
  const msg = `📊 *This week with ${recap.partnerName || 'your partner'}:*\n\n` +
    `Messages sent: ${recap.messages_sent}\n` +
    `New words: ${recap.new_words_count}\n` +
    `Streak: ${recap.streak_days} days\n` +
    `Topics: ${recap.conversation_topics.join(', ') || 'various'}`

  await bot.api.sendMessage(chatId, msg, { parse_mode: 'Markdown' })
}

async function handlePartnerCommand(bot: Bot, chatId: number, userId: string) {
  const userPartner = await getActiveUserPartner(userId)
  if (!userPartner) return

  const { partner } = userPartner
  await bot.api.sendMessage(chatId,
    `💌 *${partner.name}*, ${partner.age}\n${partner.nationality} · ${partner.language_name}\n\n_${partner.backstory?.city}_`,
    { parse_mode: 'Markdown' }
  )
}

async function handleLevelCommand(bot: Bot, chatId: number, userId: string) {
  const userPartner = await getActiveUserPartner(userId)
  if (!userPartner) return

  const levels: Record<string, string> = {
    beginner: 'Absolute Beginner 🌱',
    basics: 'Learning the Basics 🌿',
    conversational: 'Getting Conversational 🌳',
    advanced: 'Advanced 🏆',
  }

  await bot.api.sendMessage(chatId,
    `📈 Your *${userPartner.partner.language_name}* level:\n${levels[userPartner.user_level_estimate] || userPartner.user_level_estimate}`,
    { parse_mode: 'Markdown' }
  )
}

async function handleTranslateCommand(bot: Bot, chatId: number, word: string, userId: string) {
  // Quick translation
  await bot.api.sendMessage(chatId, `🔍 Translating "${word}"...`)
  // Would call translation API here
}
