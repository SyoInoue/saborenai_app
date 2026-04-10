/**
 * ペナルティ投稿 Edge Function
 * X APIにペナルティツイートを投稿し、結果をDBに記録する
 *
 * 環境変数:
 * - SUPABASE_URL: SupabaseプロジェクトURL
 * - SERVICE_ROLE_KEY: Supabaseサービスロールキー
 * - X_CLIENT_ID: XのOAuthクライアントID
 * - X_CLIENT_SECRET: XのOAuthクライアントシークレット
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS はブラウザからの直接呼び出しには不要（check-deadlineからのサーバー間通信のみ）
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SUPABASE_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const X_TWEETS_URL = 'https://api.twitter.com/2/tweets';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PENALTY_TEXT = '私はサボりました。だらしのない人間です。';
const HASHTAG = '#サボれない習慣化アプリ #YARANEVA';

interface UserRecord {
  x_access_token: string;
  x_refresh_token: string;
  x_token_expires_at: string;
  expo_push_token: string | null;
}

interface HabitRecord {
  name: string;
  penalty_text: string | null;
}

interface LogRecord {
  user_id: string;
  habit_id: string;
}

interface RefreshedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
  const clientId = Deno.env.get('X_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('X_CLIENT_SECRET') ?? '';

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // log_id のみ受け取る（user_id はDBから導出して信頼する）
    const { log_id } = await req.json() as { log_id: string };

    if (!log_id) {
      return new Response(
        JSON.stringify({ error: 'log_id が必要です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // 1. log_id から user_id・habit_id を導出（リクエスト本文を信頼しない）
    // =====================================================
    const { data: logData, error: logError } = await supabase
      .from('habit_logs')
      .select('user_id, habit_id')
      .eq('id', log_id)
      .single();

    if (logError || !logData) {
      console.error('ログ取得エラー:', logError);
      return new Response(
        JSON.stringify({ error: 'ログが見つかりません' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const log = logData as LogRecord;
    const user_id = log.user_id; // DBから取得した値を使用（リクエスト本文を信頼しない）

    // =====================================================
    // 2. ユーザー情報・習慣のペナルティ設定取得
    // =====================================================
    const [userResult, habitResult] = await Promise.all([
      supabase
        .from('users')
        .select('x_access_token, x_refresh_token, x_token_expires_at, expo_push_token')
        .eq('id', user_id)
        .single(),
      supabase
        .from('habits')
        .select('name, penalty_text')
        .eq('id', log.habit_id)
        .single(),
    ]);

    if (userResult.error || !userResult.data) {
      console.error('ユーザー取得エラー:', userResult.error);
      return new Response(
        JSON.stringify({ error: 'ユーザーが見つかりません' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = userResult.data as UserRecord;
    const habit: HabitRecord = habitResult.data
      ? (habitResult.data as HabitRecord)
      : { name: '', penalty_text: null };

    // =====================================================
    // 3. アクセストークンのリフレッシュ
    // =====================================================
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const refreshBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.x_refresh_token,
    });

    const tokenRes = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: refreshBody.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('トークンリフレッシュ失敗:', errText);

      // リフレッシュ失敗時は再認証通知
      if (user.expo_push_token) {
        await sendPushNotification(
          user.expo_push_token,
          '再認証が必要です',
          'Xの認証が切れました。アプリを開いて再ログインしてください。'
        );
      }
      return new Response(
        JSON.stringify({ error: 'トークンリフレッシュ失敗' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const freshTokens = await tokenRes.json() as RefreshedTokens;
    const newExpiresAt = new Date(Date.now() + freshTokens.expires_in * 1000).toISOString();

    // 新しいトークンをDBに保存
    await supabase
      .from('users')
      .update({
        x_access_token: freshTokens.access_token,
        x_refresh_token: freshTokens.refresh_token,
        x_token_expires_at: newExpiresAt,
      })
      .eq('id', user_id);

    // =====================================================
    // 4. ツイート投稿
    // =====================================================
    // 習慣名・日時（秒単位）を付加してツイートを毎回ユニークにする（X API重複エラー回避）
    const now = new Date();
    const jstDate = now.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      second: '2-digit',
    });
    const baseText = habit.penalty_text ?? PENALTY_TEXT;
    const penaltyText = `【${habit.name}】\n${baseText}\n\n${HASHTAG}\n📅 ${jstDate}`;

    const result = await postTextTweet(freshTokens.access_token, penaltyText);
    const tweetId = result.id;
    const tweetError = result.error;

    if (!tweetId) {
      console.error('ツイート投稿失敗:', tweetError);
      return new Response(
        JSON.stringify({ success: false, error: 'ツイート投稿失敗', detail: tweetError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // 5. DBに投稿結果を記録
    // =====================================================
    await supabase
      .from('habit_logs')
      .update({
        penalty_tweet_id: tweetId,
        penalty_executed_at: new Date().toISOString(),
      })
      .eq('id', log_id);

    // =====================================================
    // 6. プッシュ通知
    // =====================================================
    if (user.expo_push_token) {
      await sendPushNotification(
        user.expo_push_token,
        'ペナルティが執行されました ⚡',
        'Xを確認してください。次回はサボらないようにしましょう！'
      );
    }

    return new Response(
      JSON.stringify({ success: true, tweet_id: tweetId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('予期しないエラー:', error);
    return new Response(
      JSON.stringify({ error: '内部サーバーエラー' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * テキストのみのツイートを投稿する
 */
async function postTextTweet(accessToken: string, text: string): Promise<{ id: string | null; error?: string }> {
  const res = await fetch(X_TWEETS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('ツイート投稿失敗 status=' + res.status + ':', errText);
    return { id: null, error: `status=${res.status} ${errText}` };
  }

  const data = await res.json() as { data: { id: string } };
  return { id: data.data.id };
}

/**
 * Expo Push通知を送信する
 */
async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string
): Promise<void> {
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: 'default',
      }),
    });
  } catch (err) {
    console.error('プッシュ通知送信エラー:', err);
  }
}
