'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/db/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'magic' | 'oauth'>('magic')
  const [sent, setSent] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleOAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) toast.error(error.message)
  }

  const handleAppleOAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) toast.error(error.message)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#F5F0EB' }}
    >
      {/* Logo */}
      <div className="mb-10 text-center animate-fade-in">
        <h1
          className="font-playfair text-5xl text-[#1A1A1A] mb-3"
          style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}
        >
          Lingr
        </h1>
        <p className="text-[#888888] font-inter text-sm tracking-wide">
          You don&apos;t learn a language. You fall into it.
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm animate-slide-up"
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        {sent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#4A7C59]/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <h2 className="font-playfair text-xl text-[#1A1A1A] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Check your email
            </h2>
            <p className="text-[#888888] font-inter text-sm">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-[#888888] hover:text-[#1A1A1A] transition-colors font-inter"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h2
              className="font-playfair text-xl text-[#1A1A1A] mb-6 text-center"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Welcome back
            </h2>

            {/* Magic link form */}
            <form onSubmit={handleMagicLink} className="mb-4">
              <div className="mb-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl font-inter text-[15px] text-[#1A1A1A] transition-all"
                  style={{
                    background: '#F5F0EB',
                    border: '1.5px solid rgba(0,0,0,0.1)',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#1A1A1A'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(0,0,0,0.1)'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full py-3 rounded-xl font-inter text-[15px] font-medium transition-all"
                style={{
                  background: isLoading || !email ? '#AAAAAA' : '#1A1A1A',
                  color: 'white',
                  cursor: isLoading || !email ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'Sending...' : 'Continue with Email'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 separator" />
              <span className="text-[11px] text-[#AAAAAA] font-inter uppercase tracking-widest">or</span>
              <div className="flex-1 separator" />
            </div>

            {/* OAuth buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleGoogleOAuth}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-inter text-[14px] text-[#1A1A1A] transition-all hover:bg-[#F5F0EB]"
                style={{ border: '1.5px solid rgba(0,0,0,0.1)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={handleAppleOAuth}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-inter text-[14px] text-[#1A1A1A] transition-all hover:bg-[#F5F0EB]"
                style={{ border: '1.5px solid rgba(0,0,0,0.1)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Continue with Apple
              </button>
            </div>

            <p className="text-center text-[11px] text-[#AAAAAA] font-inter mt-5">
              By continuing, you agree to our Terms & Privacy Policy
            </p>
          </>
        )}
      </div>

      {/* Footer quote */}
      <p
        className="mt-8 text-center text-[#AAAAAA] font-playfair italic text-sm"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        "Language is the road map of a culture."
      </p>
    </div>
  )
}
