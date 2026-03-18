'use client'

import { useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import type { Message } from '@/types'
import { VoiceNoteBubble } from './VoiceNoteBubble'
import { useTranslateStore } from '@/stores'
import { useVocabStore } from '@/stores'

interface MessageBubbleProps {
  message: Message
  partnerName: string
  partnerAvatarUrl: string
  showAvatar?: boolean
}

export function MessageBubble({
  message,
  partnerName,
  partnerAvatarUrl,
  showAvatar = true,
}: MessageBubbleProps) {
  const { open: openTranslate } = useTranslateStore()
  const { addWord } = useVocabStore()
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [showActions, setShowActions] = useState(false)

  const isPartner = message.role === 'assistant'
  const time = format(parseISO(message.created_at), 'HH:mm')

  // Handle word tap for translation
  const handleWordTap = useCallback(async (word: string) => {
    setSelectedWord(word)
    // Call translation API
    try {
      const res = await fetch('/api/vocabulary/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, messageId: message.id }),
      })
      const data = await res.json()
      if (data.translation) {
        openTranslate(word, data.translation, message.id)
      }
    } catch {
      // Fail silently
    } finally {
      setSelectedWord(null)
    }
  }, [message.id, openTranslate])

  // Render partner message
  if (isPartner) {
    return (
      <div className="flex items-end gap-2 mb-2 animate-message-in group">
        {/* Avatar */}
        {showAvatar ? (
          <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden vintage-frame self-end mb-1">
            <img
              src={partnerAvatarUrl || '/avatars/default.jpg'}
              alt={partnerName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/avatars/default.jpg'
              }}
            />
          </div>
        ) : (
          <div className="w-7 flex-shrink-0" />
        )}

        <div className="flex flex-col items-start gap-0.5 max-w-[75%]">
          {/* Voice note or text */}
          {message.has_audio && message.audio_url ? (
            <VoiceNoteBubble
              audioUrl={message.audio_url}
              duration={message.audio_duration || 10}
              isPartner={true}
            />
          ) : (
            <div
              className="bubble-partner cursor-text"
              onClick={() => {
                // Long press or double-click for word selection
              }}
            >
              {renderMessageText(message.content, handleWordTap, selectedWord)}
            </div>
          )}

          {/* Correction indicator */}
          {message.corrections && message.corrections.length > 0 && (
            <div className="flex items-center gap-1 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4A7C59]" />
              <span className="text-[10px] text-[#888888] font-inter">
                gentle correction
              </span>
            </div>
          )}

          <span className="text-[10px] text-[#AAAAAA] font-inter px-1 mt-0.5">
            {time}
          </span>
        </div>
      </div>
    )
  }

  // User message
  return (
    <div className="flex justify-end mb-2 animate-message-in">
      <div className="flex flex-col items-end gap-0.5 max-w-[75%]">
        {message.has_audio && message.audio_url ? (
          <VoiceNoteBubble
            audioUrl={message.audio_url}
            duration={message.audio_duration || 10}
            isPartner={false}
          />
        ) : (
          <div className="bubble-user">
            <span className="text-[15px] leading-[1.55] whitespace-pre-wrap">
              {message.content}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[10px] text-[#AAAAAA] font-inter">{time}</span>
          {/* Read receipt */}
          <svg
            width="12"
            height="8"
            viewBox="0 0 12 8"
            fill="none"
            className={message.is_read ? 'text-[#4A7C59]' : 'text-[#AAAAAA]'}
          >
            <path
              d="M1 4L3.5 6.5L7 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 4L7.5 6.5L11 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

// Render text with tappable words for translation
function renderMessageText(
  content: string,
  onWordTap: (word: string) => void,
  selectedWord: string | null
) {
  // Split by words, preserving spaces and punctuation
  const tokens = content.split(/(\s+)/)

  return (
    <p className="text-[15px] leading-[1.55] whitespace-pre-wrap">
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) return token

        // Clean word for lookup
        const word = token.replace(/[.,!?;:'"()]/g, '')
        if (!word) return token

        return (
          <span
            key={i}
            onClick={() => word.length > 2 && onWordTap(word)}
            className={`cursor-pointer hover:bg-[#C0392B]/10 hover:text-[#C0392B] rounded transition-colors inline ${
              selectedWord === word ? 'bg-[#C0392B]/10 text-[#C0392B]' : ''
            }`}
          >
            {token}
          </span>
        )
      })}
    </p>
  )
}
