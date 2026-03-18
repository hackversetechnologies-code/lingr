'use client'

import { useRouter } from 'next/navigation'
import type { UserPartner } from '@/types'
import { format, parseISO } from 'date-fns'

interface ProfileStats {
  daysTogether: number
  streak: number
  totalMessages: number
  totalVocab: number
  weekVocab: number
  level: string
}

interface PartnerProfileClientProps {
  userPartner: UserPartner
  stats: ProfileStats
}

export function PartnerProfileClient({ userPartner, stats }: PartnerProfileClientProps) {
  const { partner, inside_jokes, known_facts, started_at } = userPartner
  const backstory = partner.backstory

  const levelLabels: Record<string, string> = {
    beginner: 'Absolute Beginner',
    basics: 'Learning the Basics',
    conversational: 'Getting Conversational',
    advanced: 'Advanced',
  }

  return (
    <div>
      {/* Hero — large avatar */}
      <div className="relative">
        <div
          className="w-full h-72 flex items-end justify-center pb-6"
          style={{
            background: 'linear-gradient(to bottom, #EDE8E2, #F5F0EB)',
          }}
        >
          <div className="text-center">
            {/* Avatar */}
            <div
              className="w-28 h-28 rounded-full mx-auto mb-4 overflow-hidden vintage-frame"
              style={{ border: '4px solid white' }}
            >
              <img
                src={partner.avatar_url || '/avatars/default.jpg'}
                alt={partner.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.jpg' }}
              />
            </div>

            {/* Name */}
            <h1
              className="font-playfair text-3xl italic text-[#1A1A1A]"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              {partner.name}
            </h1>
            <p className="text-[#888888] font-inter text-sm mt-1">
              {partner.age} · {backstory?.city} · {partner.nationality}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-8">

        {/* Bio */}
        <div className="mb-6">
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <p
              className="font-playfair italic text-[16px] text-[#1A1A1A] leading-relaxed mb-1"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              &ldquo;{backstory?.bio}&rdquo;
            </p>
            <p className="text-[12px] text-[#888888] font-inter italic">
              — {backstory?.bio_translation}
            </p>
          </div>
        </div>

        {/* Our Story */}
        <div className="mb-6">
          <h2
            className="font-playfair text-xl text-[#1A1A1A] mb-3"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Our Story
          </h2>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Days together" value={stats.daysTogether} />
            <StatCard label="Day streak" value={stats.streak} />
            <StatCard label="Messages" value={stats.totalMessages} />
          </div>

          <p className="text-[13px] text-[#888888] font-inter">
            Together since {format(parseISO(started_at), 'd MMMM yyyy')}
          </p>
        </div>

        {/* Language progress */}
        <div className="mb-6">
          <h2
            className="font-playfair text-xl text-[#1A1A1A] mb-3"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Your {partner.language_name}
          </h2>

          <div
            className="p-4 rounded-2xl"
            style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-inter text-sm font-medium text-[#1A1A1A]">
                {levelLabels[stats.level] || stats.level}
              </p>
              <span className="text-xs text-[#888888] font-inter">{stats.totalVocab} words</span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-[#EDE8E2] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1A1A1A] transition-all"
                style={{ width: getLevelProgress(stats.level) }}
              />
            </div>

            <p className="text-[12px] text-[#888888] font-inter mt-2">
              {stats.weekVocab} new words this week
            </p>
          </div>
        </div>

        {/* Things they know about you */}
        {known_facts && known_facts.length > 0 && (
          <div className="mb-6">
            <h2
              className="font-playfair text-xl text-[#1A1A1A] mb-3"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              What {partner.name} knows about you
            </h2>

            <div className="flex flex-col gap-2">
              {known_facts.slice(0, 8).map((fact) => (
                <div
                  key={fact.id}
                  className="flex items-start gap-3 py-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C0392B] flex-shrink-0 mt-1.5" />
                  <p className="font-inter text-[14px] text-[#1A1A1A]">{fact.fact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inside jokes */}
        {inside_jokes && inside_jokes.length > 0 && (
          <div className="mb-6">
            <h2
              className="font-playfair text-xl text-[#1A1A1A] mb-3"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Inside jokes
            </h2>

            <div className="flex flex-col gap-2">
              {inside_jokes.map((joke) => (
                <div
                  key={joke.id}
                  className="p-3 rounded-xl"
                  style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <p className="font-playfair italic text-[14px] text-[#1A1A1A]" style={{ fontFamily: 'Playfair Display, serif' }}>
                    &ldquo;{joke.reference}&rdquo;
                  </p>
                  <p className="text-[11px] text-[#888888] font-inter mt-1">{joke.context}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="separator mb-6" />

        <a
          href="/settings"
          className="flex items-center justify-between py-3 text-[#888888] font-inter text-sm hover:text-[#1A1A1A] transition-colors"
        >
          <span>Settings & Subscription</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </a>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex flex-col items-center py-3 px-2 rounded-xl text-center"
      style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }}
    >
      <p
        className="font-playfair text-2xl text-[#1A1A1A]"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        {value}
      </p>
      <p className="text-[10px] text-[#888888] font-inter uppercase tracking-wide mt-0.5">
        {label}
      </p>
    </div>
  )
}

function getLevelProgress(level: string): string {
  const map: Record<string, string> = {
    beginner: '15%',
    basics: '35%',
    conversational: '60%',
    advanced: '85%',
  }
  return map[level] || '10%'
}
