'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/db/supabase'
import toast from 'react-hot-toast'

interface SettingsClientProps {
  user: {
    id: string
    email: string
    subscription_tier?: string
    stripe_customer_id?: string
  }
}

const PLANS = [
  {
    id: 'plus',
    name: 'Lingr Plus',
    price: '$9.99',
    period: '/mo',
    features: [
      'Unlimited messages',
      'All 8 partners',
      'Voice notes (send & receive)',
      '90-day memory',
      'Telegram bot access',
    ],
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Lingr Pro',
    price: '$19.99',
    period: '/mo',
    features: [
      'Everything in Plus',
      'Custom partner creation',
      'Pronunciation feedback',
      'Advanced analytics',
      'Priority support',
    ],
    highlight: false,
  },
]

export function SettingsClient({ user }: SettingsClientProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const router = useRouter()
  const tier = user.subscription_tier || 'free'

  const handleUpgrade = async (plan: string) => {
    setIsLoading(plan)
    try {
      const res = await fetch('/api/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to start checkout')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(null)
    }
  }

  const handleManageBilling = async () => {
    setIsLoading('billing')
    try {
      const res = await fetch('/api/stripe')
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      toast.error('Failed to open billing portal')
    } finally {
      setIsLoading(null)
    }
  }

  const handleSignOut = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 safe-top">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#888888] hover:text-[#1A1A1A] transition-colors mb-4"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span className="font-inter text-sm">Back</span>
        </button>

        <h1 className="font-playfair text-3xl text-[#1A1A1A]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Settings
        </h1>
      </div>

      <div className="px-6 pb-12">

        {/* Account section */}
        <div className="mb-8">
          <h2 className="font-inter text-xs uppercase tracking-widest text-[#AAAAAA] mb-3">Account</h2>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div>
                <p className="font-inter text-sm font-medium text-[#1A1A1A]">Email</p>
                <p className="font-inter text-xs text-[#888888] mt-0.5">{user.email}</p>
              </div>
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between border-t border-[rgba(0,0,0,0.05)]">
              <div>
                <p className="font-inter text-sm font-medium text-[#1A1A1A]">Plan</p>
                <p className="font-inter text-xs text-[#888888] mt-0.5 capitalize">{tier}</p>
              </div>
              {tier !== 'free' && (
                <span
                  className="text-[10px] px-2 py-1 rounded-full font-inter font-medium uppercase"
                  style={{ background: 'rgba(74, 124, 89, 0.1)', color: '#4A7C59' }}
                >
                  Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade section */}
        {tier === 'free' && (
          <div className="mb-8">
            <h2 className="font-inter text-xs uppercase tracking-widest text-[#AAAAAA] mb-3">Upgrade</h2>

            <div className="flex flex-col gap-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl p-5"
                  style={{
                    background: plan.highlight ? '#1A1A1A' : 'white',
                    border: plan.highlight ? 'none' : '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <p
                        className="font-playfair text-lg"
                        style={{
                          fontFamily: 'Playfair Display, serif',
                          color: plan.highlight ? 'white' : '#1A1A1A',
                        }}
                      >
                        {plan.name}
                      </p>
                      {plan.highlight && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-inter font-medium uppercase mt-1 inline-block"
                          style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
                          Most popular
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className="font-playfair text-2xl"
                        style={{
                          fontFamily: 'Playfair Display, serif',
                          color: plan.highlight ? 'white' : '#1A1A1A',
                        }}
                      >
                        {plan.price}
                      </span>
                      <span
                        className="text-xs font-inter"
                        style={{ color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#888888' }}
                      >
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke={plan.highlight ? 'rgba(255,255,255,0.7)' : '#4A7C59'}
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span
                          className="font-inter text-[13px]"
                          style={{ color: plan.highlight ? 'rgba(255,255,255,0.8)' : '#1A1A1A' }}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isLoading === plan.id}
                    className="w-full py-3 rounded-xl font-inter font-medium text-[14px] transition-all"
                    style={{
                      background: plan.highlight ? 'white' : '#1A1A1A',
                      color: plan.highlight ? '#1A1A1A' : 'white',
                    }}
                  >
                    {isLoading === plan.id ? 'Loading...' : `Get ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Billing portal for subscribers */}
        {tier !== 'free' && (
          <div className="mb-8">
            <button
              onClick={handleManageBilling}
              disabled={isLoading === 'billing'}
              className="w-full py-3.5 rounded-2xl font-inter text-sm transition-all"
              style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', color: '#1A1A1A' }}
            >
              {isLoading === 'billing' ? 'Opening...' : 'Manage Billing'}
            </button>
          </div>
        )}

        {/* Danger zone */}
        <div className="separator mb-6" />

        <button
          onClick={handleSignOut}
          className="w-full py-3.5 rounded-2xl font-inter text-sm text-[#C0392B] transition-all hover:bg-[#C0392B]/5"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
