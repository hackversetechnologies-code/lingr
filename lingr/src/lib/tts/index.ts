import type { TTSResponse } from '@/types'

// ============================================
// TTS PROVIDER INTERFACES
// ============================================

// Google Cloud TTS voices mapped to partner voice_ids
const GOOGLE_VOICE_MAP: Record<string, { languageCode: string; name: string; gender: 'FEMALE' | 'MALE' }> = {
  'fr-FR-Wavenet-C': { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-C', gender: 'FEMALE' },
  'fr-FR-Wavenet-B': { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-B', gender: 'MALE' },
  'pt-BR-Wavenet-B': { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B', gender: 'MALE' },
  'ja-JP-Wavenet-B': { languageCode: 'ja-JP', name: 'ja-JP-Wavenet-B', gender: 'FEMALE' },
  'es-ES-Wavenet-C': { languageCode: 'es-ES', name: 'es-ES-Wavenet-C', gender: 'FEMALE' },
  'ru-RU-Wavenet-C': { languageCode: 'ru-RU', name: 'ru-RU-Wavenet-C', gender: 'FEMALE' },
  'ko-KR-Wavenet-C': { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-C', gender: 'MALE' },
  'cmn-CN-Wavenet-B': { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-B', gender: 'MALE' },
  'default': { languageCode: 'en-US', name: 'en-US-Wavenet-D', gender: 'MALE' },
}

// OpenAI TTS voice mapping (by gender)
const OPENAI_VOICE_MAP: Record<string, string> = {
  female: 'nova',
  male: 'onyx',
  default: 'alloy',
}

// ============================================
// GOOGLE CLOUD TTS
// ============================================

async function generateWithGoogle(
  text: string,
  voiceId: string
): Promise<TTSResponse> {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credentialsJson) throw new Error('Google credentials not configured')

  const credentials = JSON.parse(credentialsJson)
  const voice = GOOGLE_VOICE_MAP[voiceId] || GOOGLE_VOICE_MAP.default

  // Use Google TTS REST API directly (no SDK dependency issues)
  const accessToken = await getGoogleAccessToken(credentials)

  const requestBody = {
    input: { text },
    voice: {
      languageCode: voice.languageCode,
      name: voice.name,
      ssmlGender: voice.gender,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.95,  // Slightly slower for language learning
      pitch: -1.0,          // Slightly lower for naturalness
    },
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google TTS error: ${error}`)
  }

  const data = await response.json()
  const audioBuffer = Buffer.from(data.audioContent, 'base64')
  const duration = estimateAudioDuration(text)

  return { audioBuffer, duration, provider: 'google' }
}

// ============================================
// OPENAI TTS
// ============================================

async function generateWithOpenAI(
  text: string,
  gender: 'female' | 'male' | 'nonbinary' = 'female'
): Promise<TTSResponse> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  const voice = OPENAI_VOICE_MAP[gender] || OPENAI_VOICE_MAP.default

  const mp3 = await client.audio.speech.create({
    model: 'tts-1',
    voice: voice as 'nova' | 'onyx' | 'alloy' | 'echo' | 'fable' | 'shimmer',
    input: text,
    speed: 0.95,
  })

  const audioBuffer = Buffer.from(await mp3.arrayBuffer())
  return {
    audioBuffer,
    duration: estimateAudioDuration(text),
    provider: 'openai',
  }
}

// ============================================
// CARTESIA TTS
// ============================================

async function generateWithCartesia(
  text: string,
  voiceId: string
): Promise<TTSResponse> {
  const apiKey = process.env.CARTESIA_API_KEY
  if (!apiKey) throw new Error('Cartesia API key not configured')

  // Cartesia voice IDs (map from our voice IDs)
  const cartesiaVoiceMap: Record<string, string> = {
    'fr-FR-Wavenet-C': 'a0e99841-438c-4a64-b679-ae501e7d6091', // French female
    'pt-BR-Wavenet-B': '694f9389-aac1-45b6-b726-9d9369183238', // Brazilian male
    default: '248be419-c632-4f23-adf1-5324ed7dbf1d',
  }

  const cartesiaVoice = cartesiaVoiceMap[voiceId] || cartesiaVoiceMap.default

  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Cartesia-Version': '2024-06-10',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-multilingual',
      transcript: text,
      voice: {
        mode: 'id',
        id: cartesiaVoice,
      },
      output_format: {
        container: 'mp3',
        encoding: 'mp3',
        sample_rate: 44100,
      },
    }),
  })

  if (!response.ok) throw new Error(`Cartesia error: ${response.status}`)

  const audioBuffer = Buffer.from(await response.arrayBuffer())
  return {
    audioBuffer,
    duration: estimateAudioDuration(text),
    provider: 'cartesia',
  }
}

// ============================================
// ELEVENLABS TTS (premium fallback)
// ============================================

async function generateWithElevenLabs(
  text: string,
  voiceId: string
): Promise<TTSResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ElevenLabs API key not configured')

  // Map our voice IDs to ElevenLabs voice IDs
  const elevenLabsVoiceMap: Record<string, string> = {
    'fr-FR-Wavenet-C': 'EXAVITQu4vr4xnSDxMaL', // Bella (female)
    'fr-FR-Wavenet-B': 'VR6AewLTigWG4xSOukaG', // Arnold (male)
    default: 'EXAVITQu4vr4xnSDxMaL',
  }

  const elVoice = elevenLabsVoiceMap[voiceId] || elevenLabsVoiceMap.default

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`,
    {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    }
  )

  if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`)

  const audioBuffer = Buffer.from(await response.arrayBuffer())
  return {
    audioBuffer,
    duration: estimateAudioDuration(text),
    provider: 'elevenlabs',
  }
}

// ============================================
// MAIN TTS FUNCTION (with fallbacks)
// ============================================

export async function generateSpeech(
  text: string,
  voiceId: string,
  gender: 'female' | 'male' | 'nonbinary' = 'female'
): Promise<TTSResponse> {
  const providers = [
    { name: 'google', fn: () => generateWithGoogle(text, voiceId) },
    { name: 'openai', fn: () => generateWithOpenAI(text, gender) },
    { name: 'cartesia', fn: () => generateWithCartesia(text, voiceId) },
    { name: 'elevenlabs', fn: () => generateWithElevenLabs(text, voiceId) },
  ]

  let lastError: Error | null = null

  for (const provider of providers) {
    try {
      console.log(`[TTS] Trying ${provider.name}...`)
      const result = await provider.fn()
      console.log(`[TTS] Success with ${provider.name}`)
      return result
    } catch (error) {
      lastError = error as Error
      console.error(`[TTS] ${provider.name} failed:`, error)
      continue
    }
  }

  throw lastError || new Error('All TTS providers failed')
}

// ============================================
// HELPERS
// ============================================

function estimateAudioDuration(text: string): number {
  // Rough estimate: ~120 words per minute, avg 5 chars per word
  const words = text.length / 5
  const minutes = words / 120
  return Math.max(3, Math.round(minutes * 60))
}

async function getGoogleAccessToken(credentials: Record<string, string>): Promise<string> {
  // JWT-based service account auth for Google APIs
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

  // Sign with RSA private key
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
