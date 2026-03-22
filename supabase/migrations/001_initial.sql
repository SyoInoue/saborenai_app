-- =====================================================
-- サボれない習慣化アプリ 初期マイグレーション
-- =====================================================

-- pgcryptoを有効化（トークン暗号化用）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. users テーブル
-- =====================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x_user_id TEXT UNIQUE NOT NULL,
  x_username TEXT NOT NULL,
  x_display_name TEXT,
  x_avatar_url TEXT,
  x_access_token TEXT,
  x_refresh_token TEXT,
  x_token_expires_at TIMESTAMPTZ,
  penalty_type TEXT NOT NULL DEFAULT 'text',
  selfie_storage_path TEXT,
  is_pro BOOLEAN NOT NULL DEFAULT FALSE,
  pro_expires_at TIMESTAMPTZ,
  expo_push_token TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);
-- Edge Functionからのinsertを許可（service_roleで実行）
CREATE POLICY "users_insert_service" ON public.users
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- 2. habits テーブル
-- =====================================================
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  deadline_time TIME NOT NULL,
  repeat_days INTEGER[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habits_select_own" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "habits_insert_own" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habits_update_own" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "habits_delete_own" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 3. habit_logs テーブル
-- =====================================================
CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  penalty_triggered BOOLEAN DEFAULT FALSE,
  penalty_tweet_id TEXT,
  penalty_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, target_date)
);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_select_own" ON public.habit_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "logs_insert_own" ON public.habit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "logs_update_own" ON public.habit_logs
  FOR UPDATE USING (auth.uid() = user_id);
-- Edge Functionからのupdate許可（ペナルティ記録）
CREATE POLICY "logs_update_service" ON public.habit_logs
  FOR UPDATE USING (true);

-- =====================================================
-- 4. user_streaks ビュー
-- =====================================================
CREATE OR REPLACE VIEW public.user_streaks AS
SELECT
  user_id,
  COUNT(*) FILTER (
    WHERE completed_at IS NOT NULL AND completed_at <= deadline_at
  ) AS total_completed,
  (
    SELECT COUNT(*) FROM (
      SELECT target_date,
        ROW_NUMBER() OVER (ORDER BY target_date DESC) AS rn
      FROM public.habit_logs
      WHERE habit_logs.user_id = hl.user_id
        AND completed_at IS NOT NULL
        AND completed_at <= deadline_at
        AND target_date <= CURRENT_DATE
      ORDER BY target_date DESC
    ) sub
    WHERE target_date = CURRENT_DATE - (rn - 1)::INTEGER
  ) AS current_streak
FROM public.habit_logs hl
GROUP BY user_id;

-- =====================================================
-- 5. updated_at 自動更新トリガー
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. Supabase Storage バケット設定（selfies用）
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('selfies', 'selfies', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "selfies_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'selfies' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "selfies_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'selfies' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "selfies_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'selfies' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
