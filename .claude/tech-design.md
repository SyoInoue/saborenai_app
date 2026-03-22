# 技術設計: サボれない習慣化アプリ

## 1. アーキテクチャ概要

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────┐
│  Expo (iOS App) │────▶│  Supabase            │────▶│ X API   │
│                 │     │  - Auth (X OAuth)    │     │ v2      │
│  - Expo Router  │     │  - PostgreSQL        │     └─────────┘
│  - AdMob        │     │  - Edge Functions    │
│  - RevenueCat   │     │  - Storage (selfies) │     ┌─────────┐
│  - Expo Notif.  │     │  - pg_cron           │────▶│RevenueCat│
└─────────────────┘     └──────────────────────┘     │ Webhook │
                                                      └─────────┘
```

### 処理フロー（ペナルティ判定）

1. `pg_cron` が毎分実行: 期限切れ & 未完了のタスクを検出するSQL
2. 該当レコードに `penalty_triggered = true` をセット
3. Edge Function `post-penalty` をHTTPで呼び出し
4. Edge Function内で:
   a. ユーザーのX refresh_tokenを取得
   b. access_tokenにリフレッシュ
   c. ペナルティタイプに応じてツイート（テキスト or 画像+テキスト）
   d. 投稿成功/失敗をDBに記録
   e. プッシュ通知を送信

## 2. データベース設計（Supabase PostgreSQL）

### 2.1 users テーブル

```sql
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
```

### 2.2 habits テーブル

```sql
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
```

### 2.3 habit_logs テーブル

```sql
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
```

### 2.4 streaks ビュー

```sql
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
```

## 3. Supabase Edge Functions

### 3.1 check-deadline（pg_cronから毎分呼び出し）

ファイル: `supabase/functions/check-deadline/index.ts`

処理:
1. `NOW() >= deadline_at AND completed_at IS NULL AND penalty_triggered = false` のログを検索
2. `penalty_triggered = true` に更新
3. 各レコードに対して post-penalty を呼び出し

pg_cronジョブは `SELECT net.http_post(...)` で Edge Functionを呼ぶ。

### 3.2 post-penalty（ペナルティ投稿実行）

ファイル: `supabase/functions/post-penalty/index.ts`

処理:
1. log_id, user_id を受け取る
2. x_refresh_token → access_token リフレッシュ
3. ペナルティタイプに応じて投稿:
   - text: `POST /2/tweets`
   - selfie: Storage → `POST /1.1/media/upload` → `POST /2/tweets`
4. tweet_id を habit_logs に記録
5. Expo Push通知を送信
6. 失敗時: エラーログ記録（MVPではリトライなし）

X APIの制限:
- 画像アップロードは v1.1 media/upload が必要
- ツイート投稿は v2 /2/tweets
- Free tier: 1,500 tweets/月

## 4. X OAuth 2.0 PKCE フロー

```
1. アプリ: code_verifier を生成
2. アプリ: code_challenge = BASE64URL(SHA256(code_verifier))
3. アプリ: ブラウザで https://twitter.com/i/oauth2/authorize を開く
   scope=tweet.read+tweet.write+users.read+offline.access
4. ユーザー: X上で「許可」
5. X: saboapp://oauth/callback にリダイレクト
6. アプリ: code → Supabase Edge Function へ送信
7. Edge Function: code + code_verifier で token交換
8. Edge Function: access_token, refresh_token → DB保存
9. Edge Function: GET /2/users/me → ユーザー情報保存
```

Token管理:
- access_token有効期限: 2時間
- refresh_token有効期限: 6ヶ月
- penalty投稿前に必ずrefresh
- refresh失敗時: 再認証プッシュ通知

## 5. 課金（RevenueCat）

- Product ID: `pro_monthly` (¥300/月)
- App Store Connectでサブスクリプション商品作成
- Webhook → Supabase Edge Functionで is_pro 同期
- イベント: INITIAL_PURCHASE, RENEWAL, EXPIRATION, CANCELLATION

## 6. 広告（AdMob）

- app.json plugins に `react-native-google-mobile-ads` 追加
- バナー広告をホーム画面下部に配置
- `is_pro === true` で非表示
- テスト中はAdMobテストID使用

## 7. プッシュ通知

| タイプ | タイミング | 方式 |
|-------|-----------|------|
| リマインダー | 期限30分前 | Expo Local Notification |
| ペナルティ | 執行後 | Expo Push API (サーバー) |
| 再認証 | token refresh失敗 | Expo Push API (サーバー) |

## 8. セキュリティ

- X OAuthトークン: pgcryptoで暗号化保存
- 自撮り画像: Supabase Storage privateバケット（`selfies/{user_id}/`）
- RLS: 全テーブル有効化
- Edge Function APIキー: 環境変数管理
- アプリ側にsecret埋め込み禁止
