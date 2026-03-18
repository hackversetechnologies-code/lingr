'use client'

import { createBrowserClient } from '@/lib/db/supabase'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Hook for client-side auth state
export function useAuth() {
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
      if (event === 'SIGNED_IN') {
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  return supabase
}

// Hook for PWA install prompt
export function usePWAInstall() {
  useEffect(() => {
    let deferredPrompt: BeforeInstallPromptEvent | null = null

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e as BeforeInstallPromptEvent
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
}

// Hook to register service worker
export function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registered:', reg.scope))
        .catch((err) => console.error('[SW] Error:', err))
    }
  }, [])
}

// Hook for push notification subscription
export function usePushNotifications() {
  const subscribeToPush = async () => {
    if (!('PushManager' in window)) return null

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      // Save subscription to server
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      return subscription
    } catch (err) {
      console.error('[Push] Subscription failed:', err)
      return null
    }
  }

  return { subscribeToPush }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Type declaration for BeforeInstallPromptEvent
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
}
