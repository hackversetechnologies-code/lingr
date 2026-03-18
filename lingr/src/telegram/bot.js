/**
 * Standalone Telegram Bot
 * Run with: npm run telegram
 * Uses webhook in production, polling in development
 */

require('dotenv').config()

const { Bot } = require('grammy')

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN)

// Set up webhook or polling
async function startBot() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // Set webhook
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
    if (!webhookUrl) {
      console.error('TELEGRAM_WEBHOOK_URL not set')
      process.exit(1)
    }

    await bot.api.setWebhook(webhookUrl, {
      allowed_updates: ['message', 'callback_query'],
    })

    console.log(`✅ Telegram webhook set to: ${webhookUrl}`)
    console.log('Bot is ready. Webhook will handle incoming updates.')
  } else {
    // Development — use polling
    console.log('🤖 Starting Lingr Telegram bot (polling mode)...')

    bot.command('start', async (ctx) => {
      await ctx.reply(
        '🌿 *Welcome to Lingr*\n\nTo connect your account, visit the app and link Telegram in settings.',
        { parse_mode: 'Markdown' }
      )
    })

    bot.command('help', async (ctx) => {
      await ctx.reply(
        `*Lingr Bot Commands:*\n\n` +
        `/vocab — Your saved vocabulary\n` +
        `/streak — Current streak\n` +
        `/recap — Weekly recap\n` +
        `/partner — Partner info\n` +
        `/level — Your language level\n` +
        `/translate [word] — Quick translate\n\n` +
        `Or just send a message to chat with your partner!`,
        { parse_mode: 'Markdown' }
      )
    })

    // For polling, all messages are handled here
    bot.on('message:text', async (ctx) => {
      const userId = await getTelegramUser(ctx.chat.id)
      if (!userId) {
        await ctx.reply('Link your account at lingr.app first!')
        return
      }

      // Forward to main app API
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-user-id': userId,
          },
          body: JSON.stringify({
            content: ctx.message.text,
            source: 'telegram',
          }),
        })

        const data = await res.json()
        if (data.partnerMessage) {
          await ctx.reply(data.partnerMessage.content)
        }
      } catch (err) {
        console.error('Bot error:', err)
        await ctx.reply('Something went wrong. Try again!')
      }
    })

    await bot.start()
    console.log('✅ Bot started in polling mode')
  }
}

async function getTelegramUser(chatId) {
  // Simple fetch to the API to get linked user
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/user?chatId=${chatId}`)
    const data = await res.json()
    return data.userId
  } catch {
    return null
  }
}

startBot().catch(console.error)
