import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/db/supabase'
import { transcribeAudio } from '@/lib/stt'
import { getActiveUserPartner } from '@/lib/db/queries'

// POST /api/voice/stt — Transcribe user voice note
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const userPartnerId = formData.get('userPartnerId') as string

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 })
    }

    // Get language code for better transcription
    const userPartner = await getActiveUserPartner(user.id)
    const languageCode = userPartner?.partner.language_code

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    const result = await transcribeAudio(
      audioBuffer,
      audioFile.type || 'audio/webm',
      languageCode
    )

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      confidence: result.confidence,
      provider: result.provider,
    })
  } catch (error) {
    console.error('[STT] Error:', error)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}

export const config = {
  api: { bodyParser: false },
}
