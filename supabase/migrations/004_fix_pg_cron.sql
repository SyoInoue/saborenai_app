-- =====================================================
-- pg_cron 修正セットアップ
--
-- 【手順】
-- 1. Supabase Dashboard → Settings → API → service_role の「Reveal」をクリックしてキーをコピー
-- 2. 下記の YOUR_SERVICE_ROLE_KEY_HERE をそのキーに置き換えてから実行
-- 3. Supabase Dashboard → Extensions で pg_cron と pg_net が有効になっていることを確認
-- =====================================================

-- 既存の壊れたcronジョブを削除（存在しない場合はエラーになるのでIFがない点に注意）
SELECT cron.unschedule('check-deadlines-every-minute');
SELECT cron.unschedule('check-deadline-every-minute');

-- 正しいcronジョブを作成（毎分 check-deadline を呼び出す）
SELECT cron.schedule(
  'check-deadline-every-minute',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zfgfpdytyeielbcogkyt.supabase.co/functions/v1/check-deadline',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- 設定確認（このクエリを実行してジョブが表示されれば成功）
SELECT jobid, jobname, schedule, command FROM cron.job;
