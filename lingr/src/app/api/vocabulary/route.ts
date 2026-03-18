import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/db/supabase'
import { getVocabulary, saveVocabularyWord, getActiveUserPartner } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/db/supabase'

// GET /api/vocabulary
export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const userSavedOnly = searchParams.get('saved') === 'true'
    const userPartnerId = searchParams.get('userPartnerId')

    const userPartner = userPartnerId
      ? { id: userPartnerId }
      : await getActiveUserPartner(user.id)

    if (!userPartner) return NextResponse.json({ error: 'No partner found' }, { status: 404 })

    const vocab = await getVocabulary(userPartner.id, userSavedOnly)

    return NextResponse.json({ success: true, vocabulary: vocab })
  } catch (error) {
    console.error('[Vocabulary] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch vocabulary' }, { status: 500 })
  }
}

// POST /api/vocabulary — Save a word
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { word, translation, sourceMessageId, userPartnerId } = body

    const userPartner = userPartnerId
      ? { id: userPartnerId }
      : await getActiveUserPartner(user.id)

    if (!userPartner) return NextResponse.json({ error: 'No partner found' }, { status: 404 })

    const admin = createAdminClient()
    const { data: up } = await admin
      .from('user_partners')
      .select('partner:partners(language_code)')
      .eq('id', userPartner.id)
      .single()

    const partnerData = up?.partner as { language_code: string }[] | undefined
    const languageCode = partnerData?.[0]?.language_code || 'unknown'

    const entry = await saveVocabularyWord({
      user_partner_id: userPartner.id,
      word,
      translation,
      source_message_id: sourceMessageId,
      language_code: languageCode,
      times_seen: 1,
      user_saved: true,
    })

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    console.error('[Vocabulary] POST error:', error)
    return NextResponse.json({ error: 'Failed to save word' }, { status: 500 })
  }
}

// PATCH /api/vocabulary — Toggle user_saved
export async function PATCH(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, userSaved } = body

    const admin = createAdminClient()
    await admin
      .from('vocabulary')
      .update({ user_saved: userSaved })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update word' }, { status: 500 })
  }
}
