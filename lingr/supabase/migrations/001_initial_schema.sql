-- ============================================
-- LINGR — Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  native_language TEXT NOT NULL DEFAULT 'en',
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus', 'pro')),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  push_subscription JSONB
);

-- Link Supabase auth to users table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PARTNERS
-- ============================================
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('female', 'male', 'nonbinary')),
  nationality TEXT NOT NULL,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  personality_archetype TEXT NOT NULL CHECK (personality_archetype IN (
    'playful_teasing', 'warm_nurturing', 'intellectual_curious', 'passionate_intense', 'chill_laidback'
  )),
  backstory JSONB NOT NULL DEFAULT '{}',
  system_prompt_base TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  voice_id TEXT NOT NULL DEFAULT 'default',
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER_PARTNERS (the Relationship)
-- ============================================
CREATE TABLE IF NOT EXISTS user_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  streak_count INTEGER DEFAULT 0,
  last_chat_date DATE,
  relationship_stage TEXT NOT NULL DEFAULT 'new' CHECK (relationship_stage IN ('new', 'comfortable', 'deep')),
  user_level_estimate TEXT NOT NULL DEFAULT 'beginner' CHECK (user_level_estimate IN ('beginner', 'basics', 'conversational', 'advanced')),
  custom_personality JSONB,
  inside_jokes JSONB DEFAULT '[]',
  known_facts JSONB DEFAULT '[]',
  current_mood TEXT NOT NULL DEFAULT 'happy',
  mood_updated_at TIMESTAMPTZ DEFAULT NOW(),
  messages_today INTEGER DEFAULT 0,
  messages_today_reset DATE DEFAULT CURRENT_DATE,
  total_messages INTEGER DEFAULT 0,
  UNIQUE(user_id, partner_id)
);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_partner_id UUID NOT NULL REFERENCES user_partners(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'target' CHECK (language IN ('target', 'native', 'mixed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  has_audio BOOLEAN DEFAULT FALSE,
  audio_url TEXT,
  audio_duration INTEGER, -- seconds
  corrections JSONB DEFAULT '[]',
  flagged_words JSONB DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'pwa' CHECK (source IN ('pwa', 'telegram')),
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_messages_user_partner_id ON messages(user_partner_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- VOCABULARY
-- ============================================
CREATE TABLE IF NOT EXISTS vocabulary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_partner_id UUID NOT NULL REFERENCES user_partners(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  source_message_id UUID REFERENCES messages(id),
  language_code TEXT NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  times_seen INTEGER DEFAULT 1,
  user_saved BOOLEAN DEFAULT FALSE,
  example_sentence TEXT
);

CREATE INDEX idx_vocabulary_user_partner_id ON vocabulary(user_partner_id);

-- ============================================
-- MEMORIES (long-term memory with embeddings)
-- ============================================
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_partner_id UUID NOT NULL REFERENCES user_partners(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fact', 'emotion', 'event', 'mistake_pattern', 'topic_interest')),
  embedding VECTOR(1536), -- OpenAI/Claude embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_user_partner_id ON memories(user_partner_id);
-- Vector similarity index for fast semantic search
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================
-- RELATIONSHIP EVENTS / MILESTONES
-- ============================================
CREATE TABLE IF NOT EXISTS relationship_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_partner_id UUID NOT NULL REFERENCES user_partners(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATION QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
CREATE POLICY "users_own_data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "user_partners_own" ON user_partners FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "messages_own" ON messages FOR ALL USING (
  user_partner_id IN (SELECT id FROM user_partners WHERE user_id = auth.uid())
);
CREATE POLICY "vocabulary_own" ON vocabulary FOR ALL USING (
  user_partner_id IN (SELECT id FROM user_partners WHERE user_id = auth.uid())
);
CREATE POLICY "memories_own" ON memories FOR ALL USING (
  user_partner_id IN (SELECT id FROM user_partners WHERE user_id = auth.uid())
);
CREATE POLICY "events_own" ON relationship_events FOR ALL USING (
  user_partner_id IN (SELECT id FROM user_partners WHERE user_id = auth.uid())
);
CREATE POLICY "notifications_own" ON notification_queue FOR ALL USING (auth.uid() = user_id);

-- Partners are public readable
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_readable" ON partners FOR SELECT USING (TRUE);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Search memories by semantic similarity
CREATE OR REPLACE FUNCTION search_memories(
  p_user_partner_id UUID,
  p_query_embedding VECTOR(1536),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.category,
    1 - (m.embedding <=> p_query_embedding) AS similarity,
    m.created_at
  FROM memories m
  WHERE m.user_partner_id = p_user_partner_id
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Update streak on chat
CREATE OR REPLACE FUNCTION update_streak(p_user_partner_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_last_date DATE;
  v_streak INTEGER;
BEGIN
  SELECT last_chat_date, streak_count
  INTO v_last_date, v_streak
  FROM user_partners
  WHERE id = p_user_partner_id;

  IF v_last_date = CURRENT_DATE THEN
    -- Already chatted today, no change
    RETURN v_streak;
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day, increment
    v_streak := v_streak + 1;
  ELSE
    -- Streak broken, reset
    v_streak := 1;
  END IF;

  UPDATE user_partners
  SET streak_count = v_streak, last_chat_date = CURRENT_DATE
  WHERE id = p_user_partner_id;

  RETURN v_streak;
END;
$$ LANGUAGE plpgsql;

-- Reset daily message counts
CREATE OR REPLACE FUNCTION reset_daily_counts()
RETURNS VOID AS $$
BEGIN
  UPDATE user_partners
  SET messages_today = 0, messages_today_reset = CURRENT_DATE
  WHERE messages_today_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
