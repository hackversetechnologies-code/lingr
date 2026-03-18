import Stripe from 'stripe'
import { createAdminClient } from '../db/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

export { stripe }

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const admin = createAdminClient()

  // Get or create Stripe customer
  const { data: user } = await admin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  let customerId = user?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { lingr_user_id: userId },
    })
    customerId = customer.id
    await admin
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { lingr_user_id: userId },
    },
    allow_promotion_codes: true,
  })

  return session
}

export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })
  return session
}

// ============================================
// WEBHOOK HANDLER
// ============================================

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string
) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)

  const admin = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      )
      const userId = subscription.metadata.lingr_user_id
      const priceId = subscription.items.data[0].price.id

      const tier = priceId === process.env.STRIPE_PRO_PRICE_ID ? 'pro' : 'plus'

      await admin
        .from('users')
        .update({
          subscription_tier: tier,
          stripe_subscription_id: subscription.id,
        })
        .eq('id', userId)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata.lingr_user_id
      const priceId = subscription.items.data[0].price.id

      const tier = priceId === process.env.STRIPE_PRO_PRICE_ID
        ? 'pro'
        : priceId === process.env.STRIPE_PLUS_PRICE_ID
        ? 'plus'
        : 'free'

      if (subscription.status === 'active') {
        await admin
          .from('users')
          .update({ subscription_tier: tier })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata.lingr_user_id

      await admin
        .from('users')
        .update({ subscription_tier: 'free', stripe_subscription_id: null })
        .eq('id', userId)
      break
    }
  }

  return { received: true }
}
