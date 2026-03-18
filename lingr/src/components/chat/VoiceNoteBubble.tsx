'use client'

import { useState, useRef, useCallback } from 'react'

interface VoiceNoteBubbleProps {
  audioUrl: string
  duration: number
  isPartner: boolean
}

export function VoiceNoteBubble({ audioUrl, duration, isPartner }: VoiceNoteBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationRef = useRef<number | undefined>(undefined)

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => {
        setIsPlaying(false)
        setCurrentTime(0)
        cancelAnimationFrame(animationRef.current!)
      }
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      cancelAnimationFrame(animationRef.current!)
    } else {
      await audioRef.current.play()
      setIsPlaying(true)

      const updateProgress = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
          animationRef.current = requestAnimationFrame(updateProgress)
        }
      }
      updateProgress()
    }
  }, [audioUrl, isPlaying])

  const progress = duration > 0 ? currentTime / duration : 0
  const remainingTime = Math.max(0, duration - Math.floor(currentTime))
  const timeStr = `${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, '0')}`

  // Generate fake waveform bars
  const bars = generateWaveformBars(24)

  const bubbleClass = isPartner
    ? 'bg-white border border-black/5 shadow-sm'
    : 'bg-[#2C2C2C]'

  const textColor = isPartner ? '#1A1A1A' : 'white'
  const barColor = isPartner
    ? `rgba(26, 26, 26, ${isPlaying ? 0.7 : 0.3})`
    : `rgba(255, 255, 255, ${isPlaying ? 0.9 : 0.5})`

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-[18px] min-w-[200px] cursor-pointer select-none ${bubbleClass}`}
      onClick={togglePlay}
      style={{ borderRadius: isPartner ? '18px 18px 18px 4px' : '18px 18px 4px 18px' }}
    >
      {/* Play/Pause button */}
      <button
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all"
        style={{
          background: isPartner ? 'rgba(192, 57, 43, 0.1)' : 'rgba(255,255,255,0.15)',
        }}
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill={isPartner ? '#C0392B' : 'white'}>
            <rect x="1" y="1" width="4" height="10" rx="1"/>
            <rect x="7" y="1" width="4" height="10" rx="1"/>
          </svg>
        ) : (
          <svg width="12" height="14" viewBox="0 0 12 14" fill={isPartner ? '#C0392B' : 'white'}>
            <path d="M1 1L11 7L1 13V1Z"/>
          </svg>
        )}
      </button>

      {/* Waveform */}
      <div className="flex items-center gap-[2px] flex-1 h-6 relative">
        {bars.map((height, i) => {
          const barProgress = i / bars.length
          const isPlayed = barProgress <= progress

          return (
            <div
              key={i}
              className="rounded-sm flex-1 transition-all duration-100"
              style={{
                height: `${height}%`,
                background: isPlayed
                  ? isPartner ? '#C0392B' : 'rgba(255,255,255,0.9)'
                  : barColor,
                transform: isPlaying && barProgress <= progress ? 'scaleY(1.1)' : 'scaleY(1)',
              }}
            />
          )
        })}
      </div>

      {/* Duration */}
      <span
        className="flex-shrink-0 text-[11px] font-inter font-medium tabular-nums"
        style={{ color: isPartner ? '#888888' : 'rgba(255,255,255,0.7)' }}
      >
        {timeStr}
      </span>
    </div>
  )
}

// Generate realistic-looking waveform bar heights
function generateWaveformBars(count: number): number[] {
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    // Use sine wave + random for natural voice waveform look
    const base = 30
    const sineComponent = Math.sin(i * 0.8) * 20
    const randomComponent = Math.random() * 35
    bars.push(Math.max(15, Math.min(90, base + sineComponent + randomComponent)))
  }
  return bars
}
