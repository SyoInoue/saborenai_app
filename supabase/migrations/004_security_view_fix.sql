-- =====================================================
-- セキュリティ修正: user_streaks ビューのRLSバイパス対策
-- ビューはデフォルトでSECURITY DEFINERで動くためRLSをバイパスする。
-- WHERE user_id = auth.uid() を追加して自分のデータのみ返す。
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
WHERE user_id = auth.uid()
GROUP BY user_id;
