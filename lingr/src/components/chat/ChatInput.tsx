'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { useChatStore } from '@/stores'
import toast from 'react-hot-toast'

interface ChatInputProps {
  onSend: (content: string) => Promise<void>
  userPartnerId: string
  partnerName: string
  subscriptionTier: 'free' | 'plus' | 'pro'
}

export function ChatInput({ onSend, userPartnerId, partnerName, subscriptionTier }: ChatInputProps) {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const { remainingMessages } = useChatStore()

  // Auto-resize textarea
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    // Reset height
    e.target.style.height = 'auto'
    // Set height to scroll height, max 120px
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }, [])

  // Handle send
  const handleSend = useCallback(async () => {
    if (!text.trim() || isSending) return

    const content = text.trim()
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setIsSending(true)
    try {
      await onSend(content)
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }, [text, isSending, onSend])

  // Handle Enter key (send on Enter, newline on Shift+Enter)
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // Voice recording
  const startRecording = useCallback(async () => {
    if (subscriptionTier === 'free') {
      toast('Voice notes require Lingr Plus ✨', {
        icon: '🎙️',
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      audioChunksRef.current = []
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        await handleVoiceNoteUpload()
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      setRecordingDuration(0)

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => {
          if (d >= 55) {
            stopRecording()
            return d
          }
          return d + 1
        })
      }, 1000)
    } catch (err) {
      toast.error('Microphone access denied')
    }
  }, [subscriptionTier])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
    }
    setIsRecording(false)
    setRecordingDuration(0)
  }, [])

  const handleVoiceNoteUpload = useCallback(async () => {
    if (!audioChunksRef.current.length) return

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

    try {
      // Transcribe
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice-note.webm')
      formData.append('userPartnerId', userPartnerId)

      const transcribeRes = await fetch('/api/voice/stt', {
        method: 'POST',
        body: formData,
      })

      const transcribeData = await transcribeRes.json()

      if (transcribeData.transcript) {
        await onSend(transcribeData.transcript)
      } else {
        toast.error('Could not understand that — try again?')
      }
    } catch {
      toast.error('Voice note failed to send')
    }
  }, [userPartnerId, onSend])

  const hasText = text.trim().length > 0
  const isLimitReached = remainingMessages <= 0

  return (
    <div
      className="safe-bottom px-3 py-2"
      style={{
        background: 'rgba(245, 240, 235, 0.97)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Limit warning */}
      {remainingMessages <= 5 && remainingMessages > 0 && (
        <div className="text-center pb-1.5">
          <p className="text-[11px] text-[#888888] font-inter">
            {remainingMessages} message{remainingMessages !== 1 ? 's' : ''} left today ·{' '}
            <a href="/settings/upgrade" className="text-[#C0392B] underline">Upgrade</a>
          </p>
        </div>
      )}

      {isLimitReached ? (
        <div className="text-center py-2">
          <p className="text-[13px] text-[#888888] font-inter">
            Daily limit reached ·{' '}
            <a href="/settings/upgrade" className="text-[#C0392B] font-medium underline">
              Upgrade to keep chatting
            </a>
          </p>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Attach (future) */}
          <button
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors mb-0.5 opacity-40"
            disabled
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          {/* Text input */}
          <div className="flex-1 flex items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording
                  ? 'Recording...'
                  : `Message ${partnerName}...`
              }
              disabled={isRecording || isSending}
              rows={1}
              className="chat-input w-full px-4 py-2.5 resize-none transition-all"
              style={{
                minHeight: '42px',
                maxHeight: '120px',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>

          {/* Send or Voice button */}
          {hasText ? (
            <button
              onClick={handleSend}
              disabled={isSending}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all mb-0.5"
              style={{
                background: isSending ? '#888888' : '#1A1A1A',
              }}
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all mb-0.5"
              style={{
                background: isRecording ? '#C0392B' : '#1A1A1A',
                transform: isRecording ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {isRecording ? (
                <div className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 bg-white rounded-sm" />
                  <div className="w-1.5 h-1.5 bg-white rounded-sm" />
                </div>
              ) : (
                <svg width="16" height="22" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 pt-1.5">
          <div className="w-1.5 h-1.5 bg-[#C0392B] rounded-full animate-pulse" />
          <span className="text-[11px] text-[#C0392B] font-inter font-medium">
            {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')} · Release to send
          </span>
        </div>
      )}
    </div>
  )
}
