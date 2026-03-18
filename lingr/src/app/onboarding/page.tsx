'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/db/supabase'
import toast from 'react-hot-toast'
import type { UserLevel } from '@/types'

const LANGUAGES = [
  { code: 'fr', name: 'French', flag: '🇫🇷', note: 'Meet Camille or Alex' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', note: 'Meet Sofía' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', note: 'Meet Marco' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', note: 'Meet Yuki' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', note: 'Meet Jae-won' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', note: 'Meet Lena' },
  { code: 'zh', name: 'Mandarin', flag: '🇨🇳', note: 'Meet Wei' },
]

const LEVELS: { key: UserLevel; label: string; description: string }[] = [
  { key: 'beginner', label: 'I know almost nothing', description: 'A few words at most.' },
  { key: 'basics', label: 'I know a few phrases', description: 'I can introduce myself.' },
  { key: 'conversational', label: 'I can hold a basic conversation', description: 'I get by, mistakes and all.' },
  { key: 'advanced', label: "I'm fairly comfortable", description: 'I can express complex ideas.' },
]

// Simplified partner list for onboarding
const PARTNERS = [
  { id: 'camille', name: 'Camille', age: 26, city: 'Lyon', language: 'French', flag: '🇫🇷', archetype: 'Playful & teasing', bio: 'Graphic designer who argues about films she hasn\'t finished watching.', premium: false },
  { id: 'marco', name: 'Marco', age: 28, city: 'São Paulo', language: 'Portuguese', flag: '🇧🇷', archetype: 'Passionate & warm', bio: 'Jazz musician who believes everything is better with good food.', premium: false },
  { id: 'yuki', name: 'Yuki', age: 24, city: 'Kyoto', language: 'Japanese', flag: '🇯🇵', archetype: 'Warm & nurturing', bio: 'Café owner who teaches ceramics and writes letters by hand.', premium: true },
  { id: 'sofia', name: 'Sofía', age: 27, city: 'Madrid', language: 'Spanish', flag: '🇪🇸', archetype: 'Intellectual & curious', bio: 'Journalist who starts every conversation with "what if...?"', premium: true },
  { id: 'lena', name: 'Lena', age: 25, city: 'St Petersburg', language: 'Russian', flag: '🇷🇺', archetype: 'Chill & laid-back', bio: 'Illustrator who loves silence and people comfortable with it.', premium: true },
  { id: 'jaewon', name: 'Jae-won', age: 26, city: 'Seoul', language: 'Korean', flag: '🇰🇷', archetype: 'Playful & teasing', bio: 'UX designer and weekend DJ who makes jokes nobody laughs at.', premium: true },
  { id: 'wei', name: 'Wei', age: 29, city: 'Chengdu', language: 'Mandarin', flag: '🇨🇳', archetype: 'Intellectual & curious', bio: 'Environmental researcher who loves conversations that reframe the world.', premium: true },
  { id: 'alex', name: 'Alex', age: 27, city: 'Paris', language: 'French', flag: '🇫🇷', archetype: 'Warm & nurturing', bio: 'Pastry chef whose philosophy is: food is love you can chew.', premium: true },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [language, setLanguage] = useState('')
  const [languageName, setLanguageName] = useState('')
  const [level, setLevel] = useState<UserLevel | ''>('')
  const [selectedPartner, setSelectedPartner] = useState<typeof PARTNERS[0] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient()

  const filteredPartners = PARTNERS.filter(p => !language || p.language.toLowerCase().includes(languageName.toLowerCase()) || language === '')

  const handleComplete = async () => {
    if (!language || !level || !selectedPartner) return

    setIsLoading(true)
    try {
      // Update user profile
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      await supabase.from('users').update({
        native_language: 'en',
        onboarding_complete: true,
      }).eq('id', user.id)

      // Get the actual partner UUID from the database by name
      const res = await fetch('/api/partners')
      const data = await res.json()
      const partner = data.partners?.find((p: { name: string }) =>
        p.name.toLowerCase() === selectedPartner.name.toLowerCase()
      )

      if (!partner) throw new Error('Partner not found')

      // Start the relationship
      const relationRes = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: partner.id,
          level,
        }),
      })

      if (!relationRes.ok) {
        const err = await relationRes.json()
        throw new Error(err.error || 'Failed to create relationship')
      }

      router.push('/chat')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#F5F0EB' }}
    >
      {/* Logo */}
      <div className="px-6 pt-12 pb-4">
        <h1
          className="font-playfair italic text-3xl text-[#1A1A1A]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Lingr
        </h1>
      </div>

      <div className="flex-1 px-6 pb-8 overflow-y-auto">

        {/* ── STEP 1: Language ── */}
        {step === 1 && (
          <div className="animate-slide-up">
            <p className="text-[#888888] font-inter text-xs mb-2 tracking-widest uppercase">1 of 4</p>
            <h2 className="font-playfair text-3xl text-[#1A1A1A] mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
              Which language<br />calls to you?
            </h2>

            <div className="flex flex-col gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { setLanguage(lang.code); setLanguageName(lang.name) }}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all"
                  style={{
                    background: language === lang.code ? '#1A1A1A' : 'white',
                    color: language === lang.code ? 'white' : '#1A1A1A',
                    border: `1.5px solid ${language === lang.code ? '#1A1A1A' : 'rgba(0,0,0,0.08)'}`,
                  }}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <p className="font-inter text-[16px] font-medium">{lang.name}</p>
                    <p className="text-[11px] font-inter mt-0.5 opacity-60">{lang.note}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => language && setStep(2)}
              disabled={!language}
              className="w-full mt-6 py-3.5 rounded-2xl font-inter font-medium text-[15px] transition-all"
              style={{
                background: language ? '#1A1A1A' : '#AAAAAA',
                color: 'white',
                cursor: language ? 'pointer' : 'not-allowed',
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: Level ── */}
        {step === 2 && (
          <div className="animate-slide-up">
            <p className="text-[#888888] font-inter text-xs mb-2 tracking-widest uppercase">2 of 4</p>
            <h2 className="font-playfair text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Where are you?
            </h2>
            <p className="text-[#888888] font-inter text-sm mb-6">With your {languageName}.</p>

            <div className="flex flex-col gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setLevel(l.key)}
                  className="flex flex-col px-5 py-4 rounded-2xl text-left transition-all"
                  style={{
                    background: level === l.key ? '#1A1A1A' : 'white',
                    color: level === l.key ? 'white' : '#1A1A1A',
                    border: `1.5px solid ${level === l.key ? '#1A1A1A' : 'rgba(0,0,0,0.08)'}`,
                  }}
                >
                  <p className="font-inter text-[15px] font-medium">{l.label}</p>
                  <p className="text-[12px] font-inter mt-0.5 opacity-60">{l.description}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 py-3.5 rounded-2xl font-inter text-[15px] border border-[#1A1A1A]/15">
                ← Back
              </button>
              <button
                onClick={() => level && setStep(3)}
                disabled={!level}
                className="flex-[2] py-3.5 rounded-2xl font-inter font-medium text-[15px] transition-all"
                style={{
                  background: level ? '#1A1A1A' : '#AAAAAA',
                  color: 'white',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Partner selection ── */}
        {step === 3 && (
          <div className="animate-slide-up">
            <p className="text-[#888888] font-inter text-xs mb-2 tracking-widest uppercase">3 of 4</p>
            <h2 className="font-playfair text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Who do you<br />want to meet?
            </h2>
            <p className="text-[#888888] font-inter text-sm mb-6">You can always meet others later.</p>

            <div className="flex flex-col gap-3">
              {filteredPartners.map((partner) => (
                <button
                  key={partner.id}
                  onClick={() => setSelectedPartner(partner)}
                  className="flex items-start gap-4 px-4 py-4 rounded-2xl text-left transition-all"
                  style={{
                    background: selectedPartner?.id === partner.id ? '#1A1A1A' : 'white',
                    color: selectedPartner?.id === partner.id ? 'white' : '#1A1A1A',
                    border: `1.5px solid ${selectedPartner?.id === partner.id ? '#1A1A1A' : 'rgba(0,0,0,0.08)'}`,
                  }}
                >
                  {/* Avatar placeholder */}
                  <div
                    className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-2xl vintage-frame"
                    style={{ background: '#F5F0EB', flexShrink: 0 }}
                  >
                    {partner.flag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-playfair text-[17px] italic" style={{ fontFamily: 'Playfair Display, serif' }}>
                        {partner.name}
                      </p>
                      <span className="text-[11px] opacity-60">{partner.age}</span>
                      {partner.premium && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-inter font-medium"
                          style={{
                            background: selectedPartner?.id === partner.id ? 'rgba(255,255,255,0.2)' : 'rgba(192,57,43,0.1)',
                            color: selectedPartner?.id === partner.id ? 'rgba(255,255,255,0.8)' : '#C0392B',
                          }}
                        >
                          PLUS
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-60 font-inter mb-1">{partner.city} · {partner.archetype}</p>
                    <p className="text-[12px] leading-relaxed opacity-80 font-inter">{partner.bio}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep(2)} className="flex-1 py-3.5 rounded-2xl font-inter text-[15px] border border-[#1A1A1A]/15">
                ← Back
              </button>
              <button
                onClick={() => selectedPartner && setStep(4)}
                disabled={!selectedPartner}
                className="flex-[2] py-3.5 rounded-2xl font-inter font-medium text-[15px] transition-all"
                style={{
                  background: selectedPartner ? '#1A1A1A' : '#AAAAAA',
                  color: 'white',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Final ── */}
        {step === 4 && selectedPartner && (
          <div className="animate-slide-up flex flex-col items-center text-center py-8">
            <p className="text-[#888888] font-inter text-xs mb-8 tracking-widest uppercase">4 of 4</p>

            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-6 vintage-frame"
              style={{ background: '#F5F0EB' }}
            >
              {selectedPartner.flag}
            </div>

            <h2 className="font-playfair text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Your story starts now.
            </h2>
            <p className="text-[#888888] font-inter text-sm mb-2">
              {selectedPartner.name} is waiting for you.
            </p>
            <p className="text-[#AAAAAA] font-inter text-xs mb-10">
              {selectedPartner.city} · {languageName} · Day 1
            </p>

            <button
              onClick={handleComplete}
              disabled={isLoading}
              className="w-full max-w-xs py-4 rounded-2xl font-inter font-medium text-[16px] transition-all"
              style={{
                background: '#1A1A1A',
                color: 'white',
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Meeting {selectedPartner.name}...
                </span>
              ) : (
                `Meet ${selectedPartner.name} →`
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
