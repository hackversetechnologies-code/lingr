import { NextRequest, NextResponse } from 'next/server'
import { handleStripeWebhook } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.arrayBuffer()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const result = await handleStripeWebhook(
      Buffer.from(rawBody),
      signature
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    )
  }
}

export const config = {
  api: { bodyParser: false },
}
