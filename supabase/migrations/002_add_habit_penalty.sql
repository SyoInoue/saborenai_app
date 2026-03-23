-- =====================================================
-- 習慣テーブルにペナルティ設定カラムを追加
-- 習慣ごとにペナルティ種別・テキスト・自撮りパスを持つ
-- =====================================================

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS penalty_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS penalty_text TEXT,
  ADD COLUMN IF NOT EXISTS selfie_storage_path TEXT;
