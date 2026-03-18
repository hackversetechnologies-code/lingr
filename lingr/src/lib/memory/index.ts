/**
 * Memory Worker
 * Runs every 10 messages to extract long-term memories
 * Can be called as a background job or via API route
 */

import { extractMemoriesFromMessages, generateEmbedding } from '../ai'
import { getRecentMessages, saveMemory } from '../db/queries'
import { createAdminClient } from '../db/supabase'
import type { Message } from '@/types'

// ============================================
// EXTRACT & STORE MEMORIES
// ============================================

export async function processMemoriesForUserPartner(
  userPartnerId: string,
  messages?: Message[]
): Promise<number> {
  try {
    // Get recent messages if not provided
    const recentMessages = messages || await getRecentMessages(userPartnerId, 20)

    if (recentMessages.length < 5) {
      console.log(`[Memory] Not enough messages for ${userPartnerId}`)
      return 0
    }

    // Extract memories using AI
    const extractedMemories = await extractMemoriesFromMessages(recentMessages)

    if (!extractedMemories.length) {
      console.log(`[Memory] No memories extracted for ${userPartnerId}`)
      return 0
    }

    // Generate embeddings and save
    let saved = 0
    for (const memory of extractedMemories) {
      try {
        const embedding = await generateEmbedding(memory.content)
        await saveMemory({
          user_partner_id: userPartnerId,
          content: memory.content,
          category: memory.category as 'fact' | 'emotion' | 'event' | 'mistake_pattern' | 'topic_interest',
          embedding,
        })
        saved++
      } catch (err) {
        console.error(`[Memory] Failed to save memory:`, err)
      }
    }

    console.log(`[Memory] Saved ${saved} memories for ${userPartnerId}`)
    return saved
  } catch (error) {
    console.error(`[Memory] Worker error for ${userPartnerId}:`, error)
    return 0
  }
}

// ============================================
// SHOULD PROCESS CHECK
// ============================================

export async function shouldProcessMemories(userPartnerId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_partner_id', userPartnerId)

  // Process every 10 messages
  return (count || 0) % 10 === 0
}

// ============================================
// EXTRACT KNOWN FACTS FOR USER PROFILE
// ============================================

export async function extractAndUpdateKnownFacts(
  userPartnerId: string,
  userMessage: string
): Promise<void> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `Extract personal facts about the user from this message. 
Return JSON: {"facts": [{"category": "job|family|location|hobby|struggle|preference|other", "fact": "..."}]}
Only extract clear, specific facts. Return {"facts": []} if nothing notable.
Return ONLY JSON.`,
        },
        { role: 'user', content: userMessage },
      ],
    })

    const text = response.choices[0].message.content || '{"facts": []}'
    const { facts } = JSON.parse(text)

    if (!facts?.length) return

    const admin = createAdminClient()
    const { data: up } = await admin
      .from('user_partners')
      .select('known_facts')
      .eq('id', userPartnerId)
      .single()

    const existingFacts = (up?.known_facts as Array<{ id: string; category: string; fact: string; learned_at: string }>) || []
    const newFacts = facts.map((f: { category: string; fact: string }) => ({
      id: crypto.randomUUID(),
      category: f.category,
      fact: f.fact,
      learned_at: new Date().toISOString(),
    }))

    // Merge, keeping last 50 facts
    const mergedFacts = [...existingFacts, ...newFacts].slice(-50)

    await admin
      .from('user_partners')
      .update({ known_facts: mergedFacts })
      .eq('id', userPartnerId)
  } catch (err) {
    // Non-critical, don't throw
    console.error('[Memory] Failed to extract known facts:', err)
  }
}

// ============================================
// DETECT LEVEL UP
// ============================================

export async function detectLevelProgress(
  userPartnerId: string,
  totalMessages: number
): Promise<boolean> {
  // Simple heuristic: suggest level up every 100 messages
  // In production, this would analyze actual language complexity
  const milestones = [50, 100, 200, 350, 500]
  return milestones.includes(totalMessages)
}
