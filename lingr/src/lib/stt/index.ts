import type { STTResponse } from '@/types'

// ============================================
// OPENAI WHISPER STT
// ============================================

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  mimeType: string,
  languageCode?: string
): Promise<STTResponse> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  // Create a File-like object from buffer
  const blob = new Blob([audioBuffer], { type: mimeType })
  const file = new File([blob], `audio.${getExtension(mimeType)}`, { type: mimeType })

  const transcription = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: languageCode ? mapLanguageCode(languageCode) : undefined,
    response_format: 'verbose_json',
  })

  return {
    transcript: transcription.text,
    confidence: 0.95, // Whisper doesn't return confidence directly
    provider: 'openai_whisper',
  }
}

// ============================================
// GOOGLE CLOUD SPEECH STT
// ============================================

async function transcribeWithGoogle(
  audioBuffer: Buffer,
  mimeType: string,
  languageCode = 'en-US'
): Promise<STTResponse> {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credentialsJson) throw new Error('Google credentials not configured')

  const credentials = JSON.parse(credentialsJson)
  const accessToken = await getGoogleAccessToken(credentials)

  const audioContent = audioBuffer.toString('base64')

  const requestBody = {
    config: {
      encoding: getGoogleEncoding(mimeType),
      sampleRateHertz: 16000,
      languageCode: mapToGoogleLanguageCode(languageCode),
      enableAutomaticPunctuation: true,
    },
    audio: { content: audioContent },
  }

  const response = await fetch(
    'https://speech.googleapis.com/v1/speech:recognize',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) throw new Error(`Google STT error: ${response.status}`)

  const data = await response.json()
  const result = data.results?.[0]?.alternatives?.[0]

  if (!result) throw new Error('No transcription result from Google')

  return {
    transcript: result.transcript,
    confidence: result.confidence || 0.9,
    provider: 'google',
  }
}

// ============================================
// DEEPGRAM STT
// ============================================

async function transcribeWithDeepgram(
  audioBuffer: Buffer,
  mimeType: string,
  languageCode?: string
): Promise<STTResponse> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) throw new Error('Deepgram API key not configured')

  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    punctuate: 'true',
  })

  if (languageCode) {
    params.set('language', languageCode)
  }

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${params}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': mimeType,
      },
      body: audioBuffer,
    }
  )

  if (!response.ok) throw new Error(`Deepgram error: ${response.status}`)

  const data = await response.json()
  const result = data.results?.channels?.[0]?.alternatives?.[0]

  if (!result) throw new Error('No transcription from Deepgram')

  return {
    transcript: result.transcript,
    confidence: result.confidence || 0.9,
    provider: 'deepgram',
  }
}

// ============================================
// MAIN STT FUNCTION (with fallbacks)
// ============================================

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  languageCode?: string
): Promise<STTResponse> {
  const providers = [
    { name: 'openai_whisper', fn: () => transcribeWithWhisper(audioBuffer, mimeType, languageCode) },
    { name: 'google', fn: () => transcribeWithGoogle(audioBuffer, mimeType, languageCode) },
    { name: 'deepgram', fn: () => transcribeWithDeepgram(audioBuffer, mimeType, languageCode) },
  ]

  let lastError: Error | null = null

  for (const provider of providers) {
    try {
      console.log(`[STT] Trying ${provider.name}...`)
      const result = await provider.fn()
      console.log(`[STT] Success with ${provider.name}: "${result.transcript.slice(0, 50)}..."`)
      return result
    } catch (error) {
      lastError = error as Error
      console.error(`[STT] ${provider.name} failed:`, error)
      continue
    }
  }

  throw lastError || new Error('All STT providers failed')
}

// ============================================
// HELPERS
// ============================================

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  }
  return map[mimeType] || 'webm'
}

function getGoogleEncoding(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'WEBM_OPUS',
    'audio/ogg': 'OGG_OPUS',
    'audio/mp4': 'MP3',
    'audio/mpeg': 'MP3',
    'audio/wav': 'LINEAR16',
  }
  return map[mimeType] || 'WEBM_OPUS'
}

function mapLanguageCode(code: string): string {
  // Map from our language codes to ISO 639-1
  const map: Record<string, string> = {
    'fr': 'fr',
    'es': 'es',
    'pt': 'pt',
    'ru': 'ru',
    'ja': 'ja',
    'ko': 'ko',
    'zh': 'zh',
  }
  return map[code] || code
}

function mapToGoogleLanguageCode(code: string): string {
  const map: Record<string, string> = {
    'fr': 'fr-FR',
    'es': 'es-ES',
    'pt': 'pt-BR',
    'ru': 'ru-RU',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'cmn-Hans-CN',
    'en': 'en-US',
  }
  return map[code] || `${code}-${code.toUpperCase()}`
}

async function getGoogleAccessToken(credentials: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')

  const headerB64 = encode(header)
  const payloadB64 = encode(payload)
  const signingInput = `${headerB64}.${payloadB64}`

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(credentials.private_key, 'base64url')

  const jwt = `${signingInput}.${signature}`

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}
