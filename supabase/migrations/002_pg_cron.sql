-- =====================================================
-- pg_cron: 毎分 check-deadline Edge Function を呼び出す
-- =====================================================
-- ※ Supabase ダッシュボードで pg_cron と pg_net を有効化してから実行すること

-- pg_net 拡張を有効化（Edge FunctionをHTTPで呼び出すため）
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 毎分 check-deadline を呼び出すcronジョブ
SELECT cron.schedule(
  'check-deadline-every-minute',  -- ジョブ名
  '* * * * *',                    -- 毎分
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-deadline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
