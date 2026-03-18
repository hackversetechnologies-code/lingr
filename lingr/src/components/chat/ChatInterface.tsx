'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useChatStore } from '@/stores'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { DateSeparator } from '@/components/chat/DateSeparator'
import { TranslateOverlay } from '@/components/chat/TranslateOverlay'
import { WelcomeBanner } from '@/components/chat/WelcomeBanner'
import type { Message } from '@/types'
import { isSameDay, parseISO } from 'date-fns'

interface ChatInterfaceProps {
  initialMessages: Message[]
  userPartner: import('@/types').UserPartner
  userId: string
}

export default function ChatInterface({
  initialMessages,
  userPartner,
  userId,
}: ChatInterfaceProps) {
  const {
    messages,
    isTyping,
    setMessages,
    setUserPartner,
    addMessage,
    setIsTyping,
    setRemainingMessages,
  } = useChatStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Initialize store
  useEffect(() => {
    setMessages(initialMessages)
    setUserPartner(userPartner)
  }, [initialMessages, userPartner, setMessages, setUserPartner])

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    scrollToBottom(messages.length <= 20 ? 'auto' : 'smooth')
  }, [messages, isTyping, scrollToBottom])

  // Send a message
  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    // Optimistically add user message
    const optimisticUserMsg: Message = {
      id: `temp-${Date.now()}`,
      user_partner_id: userPartner.id,
      role: 'user',
      content,
      language: 'target',
      created_at: new Date().toISOString(),
      has_audio: false,
      corrections: [],
      flagged_words: [],
      source: 'pwa',
      is_read: true,
    }
    addMessage(optimisticUserMsg)

    // Show typing indicator after a natural delay
    setTimeout(() => setIsTyping(true), 600)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          userPartnerId: userPartner.id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setIsTyping(false)
        if (res.status === 429) {
          // Daily limit reached
          addMessage({
            id: `limit-${Date.now()}`,
            user_partner_id: userPartner.id,
            role: 'assistant',
            content: `Hey, we've been talking a lot today 😊 Come back tomorrow for more? (Or upgrade to keep chatting)`,
            language: 'native',
            created_at: new Date().toISOString(),
            has_audio: false,
            source: 'pwa',
            is_read: false,
          })
          return
        }
        throw new Error(data.error || 'Failed to send message')
      }

      setIsTyping(false)

      // Replace optimistic message with real user message
      setMessages((prev: Message[]) => [
        ...prev.filter((m) => m.id !== optimisticUserMsg.id),
        data.userMessage,
        data.partnerMessage,
      ])

      setRemainingMessages(data.remaining)

      // Auto-save new vocabulary words mentioned by partner
      if (data.partnerMessage.corrections?.length > 0) {
        // Flash correction indicator
      }
    } catch (err) {
      setIsTyping(false)
      console.error('Send error:', err)
    }
  }, [userPartner.id, addMessage, setIsTyping, setMessages, setRemainingMessages])

  // Group messages by date for separators
  const groupedMessages = groupMessagesByDate(messages)

  const isFirstVisit = messages.length === 0

  return (
    <div className="flex flex-col h-screen bg-[#EDE8E2] chat-container">
      {/* Header */}
      <ChatHeader userPartner={userPartner} />

      {/* Messages area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {isFirstVisit ? (
          <WelcomeBanner partnerName={userPartner.partner.name} />
        ) : (
          <>
            {/* Load more indicator */}
            {messages.length >= 50 && (
              <div className="text-center py-2">
                <button className="text-xs text-[#888888] font-inter hover:text-[#1A1A1A] transition-colors">
                  Load earlier messages
                </button>
              </div>
            )}

            {/* Messages with date separators */}
            {groupedMessages.map(({ date, messages: dayMessages }) => (
              <div key={date}>
                <DateSeparator date={date} />
                {dayMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    partnerName={userPartner.partner.name}
                    partnerAvatarUrl={userPartner.partner.avatar_url}
                  />
                ))}
              </div>
            ))}
          </>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-end gap-2 mb-1 animate-fade-in">
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 vintage-frame">
              <img
                src={userPartner.partner.avatar_url || '/avatars/default.jpg'}
                alt={userPartner.partner.name}
                className="w-full h-full object-cover"
              />
            </div>
            <TypingIndicator />
          </div>
        )}

        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Chat input */}
      <ChatInput
        onSend={handleSendMessage}
        userPartnerId={userPartner.id}
        partnerName={userPartner.partner.name}
        subscriptionTier="free" // Will be passed from parent
      />

      {/* Translation overlay */}
      <TranslateOverlay />
    </div>
  )
}

// ============================================
// HELPERS
// ============================================

function groupMessagesByDate(messages: Message[]): Array<{
  date: string
  messages: Message[]
}> {
  const groups: { date: string; messages: Message[] }[] = []

  for (const message of messages) {
    const msgDate = message.created_at.split('T')[0]
    const lastGroup = groups[groups.length - 1]

    if (lastGroup && lastGroup.date === msgDate) {
      lastGroup.messages.push(message)
    } else {
      groups.push({ date: msgDate, messages: [message] })
    }
  }

  return groups
}
