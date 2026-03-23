-- =====================================================
-- pg_cron + pg_net による毎分ペナルティチェック設定
--
-- 【手動セットアップ手順】
-- 1. Supabase Dashboard → Extensions で以下を有効化:
--    - pg_cron
--    - pg_net
-- 2. 下記SQLの <SERVICE_ROLE_KEY> を実際のキーに置換して
--    SQL Editor で実行する
-- =====================================================

-- pg_cron ジョブ: 毎分 check-deadline を呼び出す
SELECT cron.schedule(
  'check-deadlines-every-minute',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zfgfpdytyeielbcogkyt.supabase.co/functions/v1/check-deadline',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
