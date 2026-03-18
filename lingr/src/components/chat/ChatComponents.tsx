'use client'

// ============================================
// TYPING INDICATOR
// ============================================

export function TypingIndicator() {
  return (
    <div className="bubble-partner py-3">
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}

// ============================================
// DATE SEPARATOR
// ============================================

import { format, isToday, isYesterday, parseISO } from 'date-fns'

export function DateSeparator({ date }: { date: string }) {
  const parsed = parseISO(date)
  let label: string

  if (isToday(parsed)) {
    label = 'Today'
  } else if (isYesterday(parsed)) {
    label = 'Yesterday'
  } else {
    label = format(parsed, 'EEEE, d MMM').toUpperCase()
  }

  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 separator" />
      <span
        className="text-[10px] text-[#AAAAAA] font-inter tracking-widest flex-shrink-0"
        style={{ letterSpacing: '0.1em' }}
      >
        {label}
      </span>
      <div className="flex-1 separator" />
    </div>
  )
}

// ============================================
// TRANSLATE OVERLAY
// ============================================

import { useEffect } from 'react'
import { useTranslateStore, useVocabStore } from '@/stores'
import toast from 'react-hot-toast'

export function TranslateOverlay() {
  const { isOpen, word, translation, messageId, close } = useTranslateStore()
  const { addWord } = useVocabStore()

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  const handleSaveWord = async () => {
    try {
      const res = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, translation, sourceMessageId: messageId }),
      })
      const data = await res.json()
      if (data.success) {
        addWord(data.entry)
        toast.success(`"${word}" saved to your notebook`)
        close()
      }
    } catch {
      toast.error('Failed to save word')
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={close}
      />

      {/* Slide-up sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
        style={{
          background: 'white',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
          padding: '20px 24px 32px',
        }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-black/10 rounded-full mx-auto mb-5" />

        {/* Word */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="font-playfair text-2xl text-[#1A1A1A] mb-1"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              {word}
            </p>
            <p className="text-[#888888] font-inter text-base">{translation}</p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSaveWord}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all hover:bg-[#1A1A1A]"
            style={{ background: '#1A1A1A', color: 'white' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            <span className="text-[13px] font-inter font-medium">Save</span>
          </button>
        </div>

        <div className="separator my-4" />

        <p className="text-[12px] text-[#AAAAAA] font-inter">
          Tap any word in a message to translate it
        </p>
      </div>
    </>
  )
}

// ============================================
// WELCOME BANNER
// ============================================

export function WelcomeBanner({ partnerName }: { partnerName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
      <div className="w-16 h-0.5 bg-[#1A1A1A]/10 rounded-full mb-8" />
      <p
        className="font-playfair italic text-xl text-[#888888] mb-2"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        Your story with {partnerName}
      </p>
      <p className="text-[13px] text-[#AAAAAA] font-inter">
        starts now.
      </p>
      <div className="w-16 h-0.5 bg-[#1A1A1A]/10 rounded-full mt-8" />
    </div>
  )
}
