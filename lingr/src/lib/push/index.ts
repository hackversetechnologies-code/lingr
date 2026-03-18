import { createAdminClient } from '@/lib/db/supabase'

// Utility to send push notification to a user
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  const admin = createAdminClient()
  const { data: user } = await admin
    .from('users')
    .select('push_subscription')
    .eq('id', userId)
    .single()

  if (!user?.push_subscription) return

  const subscription = user.push_subscription as {
    endpoint: string
    keys: { auth: string; p256dh: string }
  }

  const payload = JSON.stringify({ title, body, data })
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!

  // Use web-push library
  try {
    const webpush = await import('web-push')
    webpush.default.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@lingr.app'}`,
      vapidPublicKey,
      vapidPrivateKey
    )

    await webpush.default.sendNotification(subscription, payload)
  } catch (err) {
    console.error('[Push] Failed to send notification:', err)
  }
}
