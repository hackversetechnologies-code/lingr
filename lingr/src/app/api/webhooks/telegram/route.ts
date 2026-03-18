import { NextRequest, NextResponse } from 'next/server'

// POST /api/webhooks/telegram
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { Bot } = await import('grammy')
    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

    // The Telegram bot handles the update
    // This connects to the main bot handler
    const { handleTelegramUpdate } = await import('@/telegram/handlers')
    await handleTelegramUpdate(bot, body)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ ok: true }) // Always return 200 to Telegram
  }
}
