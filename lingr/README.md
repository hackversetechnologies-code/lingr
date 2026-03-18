# Lingr

> Your language. Your person.

A language learning app built around one idea: you learn a language fastest when you're emotionally invested in the person you're speaking with.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Auth & Database**: Supabase (Auth + PostgreSQL + Storage + pgvector)
- **AI (with fallbacks)**: Claude (Anthropic) → OpenAI GPT-4o → Gemini 1.5 → Grok
- **TTS (with fallbacks)**: Google Cloud TTS → OpenAI TTS → Cartesia → ElevenLabs
- **STT (with fallbacks)**: OpenAI Whisper → Google Cloud STT → Deepgram
- **Payments**: Stripe
- **Telegram Bot**: grammY
- **State**: Zustand

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd lingr
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

### 3. Database setup

Run the migrations in your Supabase SQL editor:
1. `supabase/migrations/001_initial_schema.sql` — full schema
2. `supabase/migrations/002_seed_partners.sql` — 8 partner personas

### 4. Supabase Storage

Create two buckets in your Supabase dashboard:
- `lingr-audio` — voice notes (public)
- `lingr-avatars` — partner avatars (public)

### 5. Add avatars

Place partner avatar images in `public/avatars/`:
- `camille.jpg`, `marco.jpg`, `yuki.jpg`, `sofia.jpg`
- `lena.jpg`, `jaewon.jpg`, `wei.jpg`, `alex.jpg`
- `default.jpg` — fallback

Recommended: Use illustrated/artistic portraits, not photographic.

### 6. Supabase OAuth setup

In Supabase Dashboard → Auth → Providers:
- Enable Google (add client ID/secret)
- Enable Apple (add client ID/secret)

Set redirect URL: `https://your-domain.com/api/auth/callback`

### 7. Stripe setup

```bash
# Create products in Stripe dashboard:
# - Lingr Plus: $9.99/mo
# - Lingr Pro: $19.99/mo

# Add webhook endpoint: https://your-domain.com/api/webhooks/stripe
# Events to listen: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
```

### 8. Telegram bot

```bash
# 1. Create bot at t.me/BotFather
# 2. Get token, add to TELEGRAM_BOT_TOKEN
# 3. Set webhook:
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/webhooks/telegram"
```

### 9. VAPID keys (push notifications)

```bash
npx web-push generate-vapid-keys
# Add to NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
```

### 10. Run

```bash
npm run dev
```

## Production Deployment (Railway recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up

# Set environment variables in Railway dashboard
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (PWA)                       │
│  Next.js App Router · Zustand · Service Worker       │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│                  NEXT.JS API ROUTES                   │
│  /api/chat · /api/voice/* · /api/vocabulary          │
│  /api/partners · /api/stripe · /api/webhooks/*       │
└───┬────────────┬─────────────┬───────────────────────┘
    │            │             │
┌───▼───┐   ┌───▼────┐   ┌────▼───────┐
│  AI   │   │  TTS   │   │  Supabase  │
│Layer  │   │  STT   │   │  Postgres  │
│Claude │   │ Google │   │  pgvector  │
│OpenAI │   │OpenAI  │   │  Storage   │
│Gemini │   │Cartesia│   │    Auth    │
│ Grok  │   │ElevenL.│   └────────────┘
└───────┘   └────────┘
```

## Features

- ✅ AI relationship partner with long-term memory
- ✅ 8 partner personas (FR, ES, PT, JA, KO, RU, ZH)
- ✅ AI fallback chain (4 providers)
- ✅ TTS fallback chain (4 providers)  
- ✅ STT fallback chain (3 providers)
- ✅ Voice notes (record & receive)
- ✅ Tap-to-translate any word
- ✅ Vocabulary notebook
- ✅ Daily message limits (freemium)
- ✅ Streak tracking
- ✅ Relationship milestones
- ✅ Partner mood system
- ✅ Long-term memory (pgvector)
- ✅ Telegram bot
- ✅ PWA (installable, offline)
- ✅ Push notifications
- ✅ Stripe subscriptions
- ✅ Partner profile page

## Free Tier Limits

- 1 partner (Camille or Marco)
- 20 messages/day
- No voice notes
- 7-day memory window

## Subscription Tiers

| Feature | Free | Plus ($9.99) | Pro ($19.99) |
|---------|------|-------------|-------------|
| Partners | 1 | All 8 | All 8 + custom |
| Messages/day | 20 | Unlimited | Unlimited |
| Voice notes | ❌ | ✅ | ✅ |
| Memory | 7 days | 90 days | Unlimited |
| Telegram | ❌ | ✅ | ✅ |
| Pronunciation | ❌ | ❌ | ✅ |

---

Built with care by Hackverse Software Solutions · frankoge.com
