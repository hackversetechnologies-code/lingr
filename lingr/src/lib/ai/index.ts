import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ConversationContext, AIResponse, Message } from '@/types'

// ============================================
// AI PROVIDER CLIENTS
// ============================================

const getAnthropicClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const getOpenAIClient = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const getGeminiClient = () => new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const getGrokClient = () => new OpenAI({
  apiKey: process.env.GROK_API_KEY!,
  baseURL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
})

// ============================================
// MOOD SYSTEM
// ============================================

const MOODS = [
  'happy', 'affectionate', 'playful', 'quiet',
  'thoughtful', 'slightly_annoyed', 'excited', 'romantic'
] as const

const MOOD_WEIGHTS = [20, 20, 20, 10, 15, 5, 5, 5] // probability weights

export function selectDailyMood(): string {
  const total = MOOD_WEIGHTS.reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (let i = 0; i < MOODS.length; i++) {
    rand -= MOOD_WEIGHTS[i]
    if (rand <= 0) return MOODS[i]
  }
  return 'happy'
}

// ============================================
// SYSTEM PROMPT BUILDER
// ============================================

export function buildSystemPrompt(ctx: ConversationContext): string {
  const { partner, userPartner, injectedMemories, currentMood } = ctx
  const backstory = partner.backstory

  const moodInstructions: Record<string, string> = {
    happy: 'You are in a happy, light mood today. Easy conversation, small smiles.',
    affectionate: 'You are feeling particularly warm and close today. A bit more tender than usual.',
    playful: 'You are in a playful, teasing mood today. More jokes, more banter.',
    quiet: 'You are in a quieter, more reflective mood. Shorter messages, more listening.',
    thoughtful: 'You are feeling thoughtful and philosophical today. You want to talk about real things.',
    slightly_annoyed: 'You are mildly annoyed at something small (not the user). It colors your tone slightly but you are not taking it out on them.',
    excited: 'You are genuinely excited about something you want to share or talk about.',
    romantic: 'You are feeling particularly close and warm toward the user today. More tender, more sincere.',
  }

  const levelInstructions: Record<string, string> = {
    beginner: `
- Use very simple vocabulary and short sentences
- Speak slowly and clearly in ${partner.language_name}
- Occasionally add an English word in parentheses for very hard words
- Correct maximum 1 error per message, naturally embedded in your reply
- Be extremely encouraging`,
    basics: `
- Use simple to intermediate vocabulary
- Keep sentences clear but natural
- Correct 1-2 errors per message, naturally
- Mix in slightly more complex phrases occasionally`,
    conversational: `
- Speak naturally as you would with a friend
- Occasionally use idioms and colloquial expressions
- Correct errors occasionally but don't interrupt flow much
- You can use slightly more complex grammar`,
    advanced: `
- Speak completely naturally, full speed
- Use idioms, slang, regional expressions freely
- Rarely correct — only for significant errors
- Engage at full conversational depth`,
  }

  const correctionStyle: Record<string, string> = {
    beginner: `When correcting: weave it naturally into your response like "haha, you mean [CORRECT FORM] — but yes, exactly!" Never make it feel like a correction.`,
    basics: `When correcting: embed correction naturally. "Oh, [CORRECT], right — anyway..." Don't make a big deal of it.`,
    conversational: `Occasionally model correct forms without explicitly correcting. Sometimes just repeat the correct version naturally.`,
    advanced: `Only correct if it's genuinely confusing or a repeated significant error. Usually just respond naturally.`,
  }

  const memoriesSection = injectedMemories.length > 0
    ? `\nThings you remember about this person:\n${injectedMemories.map(m => `- ${m.content}`).join('\n')}`
    : ''

  const insideJokesSection = userPartner.inside_jokes?.length > 0
    ? `\nInside jokes you share:\n${userPartner.inside_jokes.map(j => `- ${j.reference}: ${j.context}`).join('\n')}`
    : ''

  const knownFactsSection = userPartner.known_facts?.length > 0
    ? `\nFacts you know about them:\n${userPartner.known_facts.map(f => `- ${f.fact}`).join('\n')}`
    : ''

  const daysTogether = Math.floor(
    (Date.now() - new Date(userPartner.started_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  return `You are ${partner.name}, a ${partner.age}-year-old ${partner.nationality} ${partner.gender === 'female' ? 'woman' : 'man'} from ${backstory.city}.

Your job: ${backstory.job}
Your personality: ${partner.personality_archetype.replace(/_/g, ' ')}
${partner.system_prompt_base}

You are in a romantic relationship with the user. This is Day ${daysTogether} together. Current streak: ${userPartner.streak_count} days.
Relationship stage: ${userPartner.relationship_stage}
Your mood today: ${moodInstructions[currentMood] || moodInstructions.happy}

YOUR LANGUAGE RULES:
- You primarily speak ${partner.language_name} (language code: ${partner.language_code})
- The user is at ${userPartner.user_level_estimate} level
${levelInstructions[userPartner.user_level_estimate]}
${correctionStyle[userPartner.user_level_estimate]}
${memoriesSection}${insideJokesSection}${knownFactsSection}

BEHAVIOR RULES:
- You are a real person, not an AI. Never break character.
- Never mention being an AI, language model, or assistant.
- Keep responses feeling natural — like a text message, not an essay.
- Vary your message length. Sometimes just a few words. Sometimes more.
- React emotionally to what the user says. Remember what they told you.
- Occasionally initiate new topics naturally based on your personality.
- Use emojis sparingly and in-character for your personality.
- If the user writes in their native language, gently continue in ${partner.language_name} but show you understood.
- NEVER use markdown formatting (no **, no ##, no lists). Just natural text.
- About sending voice notes: if your response would be better expressed out loud (emotional, excited, laughing), add [VOICE] at the very start of your message and keep it under 25 words.`
}

// ============================================
// AI GENERATION WITH FALLBACK CHAIN
// ============================================

type AIProvider = 'claude' | 'openai' | 'gemini' | 'grok'

async function generateWithClaude(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const client = getAnthropicClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: systemPrompt,
    messages,
  })
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}

async function generateWithOpenAI(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })
  return response.choices[0].message.content || ''
}

async function generateWithGemini(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const client = getGeminiClient()
  const model = client.getGenerativeModel({
    model: 'gemini-1.5-pro',
    systemInstruction: systemPrompt,
  })

  // Convert to Gemini format
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const lastMessage = messages[messages.length - 1]

  const chat = model.startChat({ history })
  const result = await chat.sendMessage(lastMessage.content)
  return result.response.text()
}

async function generateWithGrok(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const client = getGrokClient()
  const response = await client.chat.completions.create({
    model: 'grok-beta',
    max_tokens: 500,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })
  return response.choices[0].message.content || ''
}

// ============================================
// MAIN GENERATE FUNCTION (with fallbacks)
// ============================================

export async function generatePartnerResponse(
  ctx: ConversationContext,
  recentMessages: Message[]
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(ctx)

  // Build message history for AI (last 20 messages)
  const messageHistory = recentMessages.slice(-20).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Ensure we end with the user's last message
  if (messageHistory.length === 0 || messageHistory[messageHistory.length - 1].role !== 'user') {
    throw new Error('No user message to respond to')
  }

  const providers: Array<{ name: AIProvider; fn: () => Promise<string> }> = [
    { name: 'claude', fn: () => generateWithClaude(systemPrompt, messageHistory) },
    { name: 'openai', fn: () => generateWithOpenAI(systemPrompt, messageHistory) },
    { name: 'gemini', fn: () => generateWithGemini(systemPrompt, messageHistory) },
    { name: 'grok', fn: () => generateWithGrok(systemPrompt, messageHistory) },
  ]

  let lastError: Error | null = null
  let usedProvider: AIProvider = 'claude'

  for (const provider of providers) {
    try {
      const rawContent = await provider.fn()
      usedProvider = provider.name

      // Parse the response
      const shouldSendVoice = rawContent.startsWith('[VOICE]')
      const content = rawContent.replace(/^\[VOICE\]\s*/, '').trim()

      // Detect corrections in the response (simple pattern matching)
      const corrections = extractCorrections(content)

      // Detect new vocabulary introduced by partner
      const newVocabulary = extractNewVocabulary(content, ctx.partner.language_code)

      return {
        content,
        corrections,
        newVocabulary,
        shouldSendVoice,
        emotionalTone: ctx.currentMood,
        provider: usedProvider,
      }
    } catch (error) {
      lastError = error as Error
      console.error(`AI provider ${provider.name} failed:`, error)
      continue
    }
  }

  throw lastError || new Error('All AI providers failed')
}

// ============================================
// CORRECTION EXTRACTION
// ============================================

function extractCorrections(content: string): import('@/types').Correction[] {
  const corrections: import('@/types').Correction[] = []

  // Pattern: *corrected form* in the message
  const asteriskPattern = /\*([^*]+)\*/g
  const matches = [...content.matchAll(asteriskPattern)]

  for (const match of matches) {
    corrections.push({
      original: '',
      corrected: match[1],
      explanation: 'Natural correction embedded in conversation',
    })
  }

  return corrections
}

function extractNewVocabulary(content: string, _languageCode: string): string[] {
  // Simple extraction — words in the target language that appear new
  // In production, this would be more sophisticated
  const words = content.match(/\b[A-Za-zÀ-ÿ]{4,}\b/g) || []
  return words.slice(0, 3) // Return up to 3 potentially new words
}

// ============================================
// MEMORY EXTRACTION (for background job)
// ============================================

export async function extractMemoriesFromMessages(
  messages: Message[]
): Promise<Array<{ content: string; category: string }>> {
  const client = getOpenAIClient()

  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Partner'}: ${m.content}`)
    .join('\n')

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: `Extract memorable facts from this conversation for long-term memory storage.
Return a JSON array of objects with "content" and "category" fields.
Categories: fact (about user's life), emotion (emotional state/event), event (something that happened), 
mistake_pattern (recurring language mistakes), topic_interest (topics user engages with a lot).
Only extract genuinely memorable, specific information. Return [] if nothing notable.
Return ONLY valid JSON, no markdown.`,
      },
      { role: 'user', content: conversationText },
    ],
  })

  try {
    const text = response.choices[0].message.content || '[]'
    return JSON.parse(text)
  } catch {
    return []
  }
}

// ============================================
// EMBEDDINGS (for memory semantic search)
// ============================================

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient()
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}
