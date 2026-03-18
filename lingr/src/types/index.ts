// ============================================
// LINGR — Type Definitions
// ============================================

export type SubscriptionTier = 'free' | 'plus' | 'pro'
export type RelationshipStage = 'new' | 'comfortable' | 'deep'
export type UserLevel = 'beginner' | 'basics' | 'conversational' | 'advanced'
export type PersonalityArchetype =
  | 'playful_teasing'
  | 'warm_nurturing'
  | 'intellectual_curious'
  | 'passionate_intense'
  | 'chill_laidback'

export type PartnerGender = 'female' | 'male' | 'nonbinary'
export type MessageRole = 'user' | 'assistant'
export type MessageLanguage = 'target' | 'native' | 'mixed'
export type MessageSource = 'pwa' | 'telegram'

export type MoodState =
  | 'happy'
  | 'affectionate'
  | 'playful'
  | 'quiet'
  | 'thoughtful'
  | 'slightly_annoyed'
  | 'excited'
  | 'romantic'

export interface User {
  id: string
  email: string
  created_at: string
  native_language: string
  subscription_tier: SubscriptionTier
  onboarding_complete: boolean
  last_active_at: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  push_subscription?: string
}

export interface Partner {
  id: string
  name: string
  age: number
  gender: PartnerGender
  nationality: string
  language_code: string
  language_name: string
  personality_archetype: PersonalityArchetype
  backstory: PartnerBackstory
  system_prompt_base: string
  avatar_url: string
  voice_id: string // TTS voice identifier
  is_premium: boolean
}

export interface PartnerBackstory {
  city: string
  job: string
  hobbies: string[]
  favorite_things: string[]
  bio: string
  bio_translation: string
  accent_notes: string
}

export interface UserPartner {
  id: string
  user_id: string
  partner_id: string
  partner: Partner
  started_at: string
  streak_count: number
  last_chat_date: string
  relationship_stage: RelationshipStage
  user_level_estimate: UserLevel
  custom_personality: CustomPersonality | null
  inside_jokes: InsideJoke[]
  known_facts: KnownFact[]
  current_mood: MoodState
  mood_updated_at: string
  messages_today: number
  total_messages: number
}

export interface CustomPersonality {
  serious_playful: number // 0-100
  reserved_flirty: number // 0-100
  formal_casual: number // 0-100
}

export interface InsideJoke {
  id: string
  reference: string
  context: string
  date: string
}

export interface KnownFact {
  id: string
  category: 'job' | 'family' | 'location' | 'hobby' | 'struggle' | 'preference' | 'other'
  fact: string
  learned_at: string
}

export interface Message {
  id: string
  user_partner_id: string
  role: MessageRole
  content: string
  language: MessageLanguage
  created_at: string
  has_audio: boolean
  audio_url?: string
  audio_duration?: number
  corrections?: Correction[]
  flagged_words?: string[]
  source: MessageSource
  is_read: boolean
}

export interface Correction {
  original: string
  corrected: string
  explanation: string
  rule?: string
}

export interface VocabularyEntry {
  id: string
  user_partner_id: string
  word: string
  translation: string
  source_message_id: string
  language_code: string
  saved_at: string
  times_seen: number
  user_saved: boolean
  example_sentence?: string
}

export interface RelationshipEvent {
  id: string
  user_partner_id: string
  event_type:
    | 'streak_milestone'
    | 'message_milestone'
    | 'level_up'
    | 'argument'
    | 'makeup'
    | 'anniversary'
    | 'first_voice_note'
  event_data: Record<string, unknown>
  triggered_at: string
}

export interface Memory {
  id: string
  user_partner_id: string
  content: string
  category: 'fact' | 'emotion' | 'event' | 'mistake_pattern' | 'topic_interest'
  embedding?: number[]
  created_at: string
  relevance_score?: number
}

export interface ConversationContext {
  partner: Partner
  userPartner: UserPartner
  recentMessages: Message[]
  injectedMemories: Memory[]
  userLevel: UserLevel
  currentMood: MoodState
  correctionStyle: 'gentle' | 'direct' | 'never'
  insideJokes: InsideJoke[]
  knownFacts: KnownFact[]
}

export interface AIResponse {
  content: string
  corrections?: Correction[]
  newVocabulary?: string[]
  shouldSendVoice: boolean
  emotionalTone: string
  provider: 'claude' | 'openai' | 'gemini' | 'grok'
}

export interface TTSResponse {
  audioBuffer: Buffer
  duration: number
  provider: 'google' | 'openai' | 'cartesia' | 'elevenlabs'
}

export interface STTResponse {
  transcript: string
  confidence: number
  provider: 'openai_whisper' | 'google' | 'deepgram'
}

export interface OnboardingState {
  step: number
  targetLanguage: string
  targetLanguageName: string
  nativeLanguage: string
  level: UserLevel
  selectedPartnerId: string
}

export interface WeeklyRecap {
  week_start: string
  new_words_count: number
  new_words: VocabularyEntry[]
  conversation_topics: string[]
  messages_sent: number
  streak_days: number
  level_progress: string
}

// API Response types
export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: string
  code?: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// Stripe
export interface StripeSubscription {
  id: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  plan: 'plus' | 'pro'
  current_period_end: number
}
