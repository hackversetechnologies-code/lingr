import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, createAdminClient } from '@/lib/db/supabase'
import { createCheckoutSession, createPortalSession } from '@/lib/stripe'

// POST /api/stripe/checkout
export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { plan } = body // 'plus' | 'pro'

    const priceId = plan === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID!
      : process.env.STRIPE_PLUS_PRICE_ID!

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await createCheckoutSession(
      user.id,
      user.email || '',
      priceId,
      `${baseUrl}/settings?upgrade=success`,
      `${baseUrl}/settings?upgrade=cancelled`
    )

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe] Checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }
}

// GET /api/stripe/portal
export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: userProfile } = await admin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await createPortalSession(
      userProfile.stripe_customer_id,
      `${baseUrl}/settings`
    )

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe] Portal error:', error)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
