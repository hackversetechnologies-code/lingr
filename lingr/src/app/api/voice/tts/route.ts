import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/db/supabase'
import { generateSpeech } from '@/lib/tts'
import { getActiveUserPartner } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/db/supabase'

// POST /api/voice/tts — Generate partner voice note
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check subscription (voice is Plus/Pro only)
    const admin = createAdminClient()
    const { data: userProfile } = await admin
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    if (userProfile?.subscription_tier === 'free') {
      return NextResponse.json(
        { error: 'Voice notes require Lingr Plus', upgrade_url: '/settings/upgrade' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { text, userPartnerId } = body

    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 })

    // Get partner details for voice
    const userPartner = await getActiveUserPartner(user.id)
    if (!userPartner) return NextResponse.json({ error: 'No partner found' }, { status: 404 })

    // Generate speech
    const ttsResult = await generateSpeech(
      text,
      userPartner.partner.voice_id,
      userPartner.partner.gender as 'female' | 'male' | 'nonbinary'
    )

    // Upload to Supabase Storage
    const filename = `${userPartnerId || userPartner.id}/${Date.now()}.mp3`
    const { data: uploadData, error: uploadError } = await admin.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET_AUDIO || 'lingr-audio')
      .upload(filename, ttsResult.audioBuffer, {
        contentType: 'audio/mpeg',
      })

    if (uploadError || !uploadData) {
      throw new Error('Failed to upload audio')
    }

    const { data: urlData } = admin.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET_AUDIO || 'lingr-audio')
      .getPublicUrl(filename)

    return NextResponse.json({
      success: true,
      audioUrl: urlData.publicUrl,
      duration: ttsResult.duration,
      provider: ttsResult.provider,
    })
  } catch (error) {
    console.error('[TTS] Error:', error)
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
  }
}
