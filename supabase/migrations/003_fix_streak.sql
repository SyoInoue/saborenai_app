-- =====================================================
-- ストリーク計算バグ修正
-- 同日に複数習慣を完了すると日付が重複してカウントがずれる問題を修正
-- DISTINCT で日付を一意にしてからROW_NUMBERを振る
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
      FROM (
        SELECT DISTINCT target_date
        FROM public.habit_logs sub
        WHERE sub.user_id = hl.user_id
          AND completed_at IS NOT NULL
          AND completed_at <= deadline_at
          AND target_date <= CURRENT_DATE
      ) dates
    ) ranked
    WHERE target_date = CURRENT_DATE - (rn - 1)::INTEGER
  ) AS current_streak
FROM public.habit_logs hl
GROUP BY user_id;
