import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/db/supabase'
import { getActiveUserPartner } from '@/lib/db/queries'

// POST /api/vocabulary/translate
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { word, messageId } = await req.json()
    if (!word) return NextResponse.json({ error: 'Word required' }, { status: 400 })

    const userPartner = await getActiveUserPartner(user.id)
    if (!userPartner) return NextResponse.json({ error: 'No partner' }, { status: 404 })

    // Use OpenAI for quick translation
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: `Translate the given ${userPartner.partner.language_name} word to English. 
Return ONLY the translation, nothing else. Be concise.`,
        },
        { role: 'user', content: word },
      ],
    })

    const translation = res.choices[0].message.content?.trim() || ''

    return NextResponse.json({ success: true, word, translation })
  } catch (error) {
    console.error('[Translate] Error:', error)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
