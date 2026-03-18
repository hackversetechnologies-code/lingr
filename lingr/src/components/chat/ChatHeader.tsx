'use client'

import { useRouter } from 'next/navigation'
import type { UserPartner } from '@/types'

interface ChatHeaderProps {
  userPartner: UserPartner
}

export function ChatHeader({ userPartner }: ChatHeaderProps) {
  const router = useRouter()
  const { partner, streak_count, started_at } = userPartner

  const daysTogether = Math.floor(
    (Date.now() - new Date(started_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <header
      className="flex items-center gap-3 px-4 py-3 safe-top pwa-header"
      style={{
        background: 'rgba(245, 240, 235, 0.97)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Partner avatar */}
      <button
        onClick={() => router.push('/profile')}
        className="flex-shrink-0 relative"
      >
        <div
          className="w-10 h-10 rounded-full overflow-hidden vintage-frame"
          style={{ filter: 'sepia(8%) contrast(1.05)' }}
        >
          <img
            src={partner.avatar_url || '/avatars/default.jpg'}
            alt={partner.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/avatars/default.jpg'
            }}
          />
        </div>
        {/* Online indicator */}
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#4A7C59] rounded-full border-2 border-[#F5F0EB]" />
      </button>

      {/* Partner info */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => router.push('/profile')}
          className="block text-left"
        >
          <h1
            className="font-playfair text-[17px] italic text-[#1A1A1A] leading-tight truncate"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {partner.name}
          </h1>
          <p className="text-[11px] text-[#888888] font-inter mt-0.5">
            {streak_count > 0 ? (
              <>Day {daysTogether + 1} together · {streak_count} day streak</>
            ) : (
              <>Day {daysTogether + 1} together</>
            )}
          </p>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Voice call (future feature) */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors opacity-40 cursor-not-allowed"
          title="Voice call — coming soon"
          disabled
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.8 19.79 19.79 0 01.5 4.16 2 2 0 012.48 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.91a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
        </button>

        {/* Partner info */}
        <button
          onClick={() => router.push('/profile')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
