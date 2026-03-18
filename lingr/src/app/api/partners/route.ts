import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, createAdminClient, createServerSupabaseClient } from '@/lib/db/supabase'

// GET /api/partners — List all partners
export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: userProfile } = await admin
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const supabase = await createServerSupabaseClient()
    const { data: partners } = await supabase
      .from('partners')
      .select('*')
      .order('is_premium', { ascending: true })

    // Mark which partners the user has access to
    const enrichedPartners = (partners || []).map(p => ({
      ...p,
      accessible: !p.is_premium || userProfile?.subscription_tier !== 'free',
    }))

    return NextResponse.json({ success: true, partners: enrichedPartners })
  } catch (error) {
    console.error('[Partners] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
  }
}

// POST /api/partners — Start a relationship with a partner
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { partnerId, level, customPersonality } = body

    if (!partnerId) return NextResponse.json({ error: 'Partner ID required' }, { status: 400 })

    const admin = createAdminClient()

    // Check subscription — free users can only have 1 partner
    const { data: userProfile } = await admin
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const { count: existingPartnersCount } = await admin
      .from('user_partners')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (userProfile?.subscription_tier === 'free' && (existingPartnersCount || 0) >= 1) {
      return NextResponse.json(
        { error: 'Free users can only have 1 partner. Upgrade to meet more.', upgrade_url: '/settings/upgrade' },
        { status: 403 }
      )
    }

    // Check if partner is premium and user doesn't have access
    const { data: partner } = await admin
      .from('partners')
      .select('*')
      .eq('id', partnerId)
      .single()

    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

    if (partner.is_premium && userProfile?.subscription_tier === 'free') {
      return NextResponse.json(
        { error: 'This partner requires Lingr Plus', upgrade_url: '/settings/upgrade' },
        { status: 403 }
      )
    }

    // Check if relationship already exists
    const { data: existing } = await admin
      .from('user_partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_id', partnerId)
      .single()

    if (existing) {
      return NextResponse.json({ success: true, userPartnerId: existing.id, exists: true })
    }

    // Create the relationship
    const { data: userPartner, error } = await admin
      .from('user_partners')
      .insert({
        user_id: user.id,
        partner_id: partnerId,
        user_level_estimate: level || 'beginner',
        custom_personality: customPersonality || null,
        current_mood: 'happy',
        mood_updated_at: new Date().toISOString(),
        last_chat_date: new Date().toISOString().split('T')[0],
        streak_count: 0,
      })
      .select()
      .single()

    if (error) throw error

    // Generate opening message from partner
    const openingMessage = await generateOpeningMessage(partner, level || 'beginner')

    await admin.from('messages').insert({
      user_partner_id: userPartner.id,
      role: 'assistant',
      content: openingMessage,
      language: 'target',
      has_audio: false,
      corrections: [],
      flagged_words: [],
      source: 'pwa',
      is_read: false,
    })

    return NextResponse.json({ success: true, userPartnerId: userPartner.id })
  } catch (error) {
    console.error('[Partners] POST error:', error)
    return NextResponse.json({ error: 'Failed to create relationship' }, { status: 500 })
  }
}

// Generate a first message from the partner
async function generateOpeningMessage(partner: { name: string; language_name: string; language_code: string; personality_archetype: string; backstory: { city: string } }, level: string): Promise<string> {
  const openingMessages: Record<string, Record<string, string>> = {
    'fr': {
      beginner: `Salut ! Je m'appelle ${partner.name}. Content(e) de te rencontrer ! 😊`,
      basics: `Hey ! Moi c'est ${partner.name}. Je suis de ${partner.backstory.city}. Et toi, tu viens d'où ?`,
      conversational: `Salut ! ${partner.name} ici. J'espère qu'on va bien s'entendre. Tu apprends le français depuis longtemps ?`,
      advanced: `Ah, te voilà enfin. Je suis ${partner.name}. On m'a dit que tu voulais pratiquer — j'espère que tu es prêt(e) pour des vraies conversations.`,
    },
    'es': {
      beginner: `¡Hola! Me llamo ${partner.name}. ¡Encantada de conocerte! 😊`,
      basics: `¡Hey! Soy ${partner.name}, de ${partner.backstory.city}. ¿Y tú, de dónde eres?`,
      conversational: `¡Hola! Soy ${partner.name}. Cuéntame, ¿cuánto tiempo llevas aprendiendo español?`,
      advanced: `Hola. ${partner.name}. Dicen que quieres practicar — me alegra. ¿Por dónde empezamos?`,
    },
    'pt': {
      beginner: `Oi! Me chamo ${partner.name}. Prazer em te conhecer! 😊`,
      basics: `Ei! Sou ${partner.name}, de ${partner.backstory.city}. E você, de onde é?`,
      conversational: `Oi! Sou ${partner.name}. Me conta, há quanto tempo você estuda português?`,
      advanced: `Oi. ${partner.name}. Disseram que você quer praticar português sério. Ótimo — vamos lá.`,
    },
    'ja': {
      beginner: `こんにちは！${partner.name}です。はじめまして！😊`,
      basics: `こんにちは！${partner.name}といいます。${partner.backstory.city}に住んでいます。よろしくね！`,
      conversational: `こんにちは。${partner.name}です。日本語はどのくらい勉強してるの？`,
      advanced: `こんにちは。${partner.name}です。日本語の練習、楽しみにしてたよ。`,
    },
    'ko': {
      beginner: `안녕하세요! ${partner.name}이에요. 만나서 반가워요! 😊`,
      basics: `안녕! 나는 ${partner.name}이야. ${partner.backstory.city}에 살아. 한국어 배우고 있어?`,
      conversational: `안녕하세요! ${partner.name}이에요. 한국어는 얼마나 배우셨어요?`,
      advanced: `안녕. ${partner.name}이야. 진짜 대화 해보자구!`,
    },
    'ru': {
      beginner: `Привет! Меня зовут ${partner.name}. Приятно познакомиться! 😊`,
      basics: `Привет! Я ${partner.name}, из ${partner.backstory.city}. А ты откуда?`,
      conversational: `Привет! ${partner.name}. Давно учишь русский?`,
      advanced: `Привет. Я ${partner.name}. Говорят, хочешь практиковать русский — я рада.`,
    },
    'zh': {
      beginner: `你好！我叫${partner.name}。很高兴认识你！😊`,
      basics: `你好！我是${partner.name}，来自${partner.backstory.city}。你呢？`,
      conversational: `你好！我是${partner.name}。你学中文多久了？`,
      advanced: `你好。我叫${partner.name}。听说你想练习中文，我们来聊聊吧。`,
    },
  }

  const langMessages = openingMessages[partner.language_code]
  if (langMessages) {
    return langMessages[level] || langMessages.beginner
  }

  return `Hi! I'm ${partner.name}. Nice to meet you! 😊`
}
