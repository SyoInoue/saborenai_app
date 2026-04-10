-- =====================================================
-- user_streaks ビュー修正
-- 習慣ごとではなく「日付単位」で連続達成をカウントする
-- =====================================================

CREATE OR REPLACE VIEW public.user_streaks AS
WITH completed_dates AS (
  -- 期限内に完了したログを「日付単位」で重複排除
  SELECT DISTINCT user_id, target_date
  FROM public.habit_logs
  WHERE completed_at IS NOT NULL
    AND completed_at <= deadline_at
    AND target_date <= CURRENT_DATE
),
numbered AS (
  -- 最新日から順番に番号を振る（ユーザーごと）
  SELECT
    user_id,
    target_date,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY target_date DESC) AS rn
  FROM completed_dates
),
current_streaks AS (
  -- 今日から遡って日付が連続している分だけカウント
  -- 例: rn=1 → today, rn=2 → yesterday, rn=3 → 2日前 が成立すれば streak=3
  SELECT user_id, COUNT(*) AS current_streak
  FROM numbered
  WHERE target_date = CURRENT_DATE - (rn - 1)::INTEGER
  GROUP BY user_id
)
SELECT
  hl.user_id,
  COUNT(CASE WHEN hl.completed_at IS NOT NULL AND hl.completed_at <= hl.deadline_at THEN 1 END) AS total_completed,
  COALESCE(MAX(cs.current_streak), 0) AS current_streak
FROM public.habit_logs hl
LEFT JOIN current_streaks cs ON cs.user_id = hl.user_id
GROUP BY hl.user_id;
