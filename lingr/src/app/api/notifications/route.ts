import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, createAdminClient } from '@/lib/db/supabase'

// POST /api/notifications/subscribe — Save push subscription
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const subscription = await req.json()

    const admin = createAdminClient()
    await admin
      .from('users')
      .update({ push_subscription: subscription })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}
