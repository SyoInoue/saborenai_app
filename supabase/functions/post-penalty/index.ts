/**
 * ペナルティ投稿 Edge Function
 * X APIにペナルティツイートを投稿し、結果をDBに記録する
 *
 * 環境変数:
 * - SUPABASE_URL: SupabaseプロジェクトURL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabaseサービスロールキー
 * - X_CLIENT_ID: XのOAuthクライアントID
 * - X_CLIENT_SECRET: XのOAuthクライアントシークレット
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const X_TWEETS_URL = 'https://api.twitter.com/2/tweets';
const X_MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PENALTY_TEXT = '私はサボりました。だらしのない人間です。 #サボれない習慣化アプリ';

interface UserRecord {
  x_access_token: string;
  x_refresh_token: string;
  x_token_expires_at: string;
  penalty_type: string;
  selfie_storage_path: string | null;
  expo_push_token: string | null;
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const clientId = Deno.env.get('X_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('X_CLIENT_SECRET') ?? '';

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { log_id, user_id } = await req.json() as { log_id: string; user_id: string };

    if (!log_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'log_id と user_id が必要です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // 1. ユーザー情報取得
    // =====================================================
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('x_access_token, x_refresh_token, x_token_expires_at, penalty_type, selfie_storage_path, expo_push_token')
      .eq('id', user_id)
      .single();

    if (userError || !userRecord) {
      console.error('ユーザー取得エラー:', userError);
      return new Response(
        JSON.stringify({ error: 'ユーザーが見つかりません' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = userRecord as UserRecord;

    // =====================================================
    // 2. アクセストークンのリフレッシュ
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
    // 3. ツイート投稿
    // =====================================================
    let tweetId: string | null = null;

    if (user.penalty_type === 'selfie' && user.selfie_storage_path) {
      // 自撮りモード: Storage から画像を取得して media/upload → tweet
      tweetId = await postSelfie(
        supabase,
        supabaseUrl,
        serviceRoleKey,
        freshTokens.access_token,
        user.selfie_storage_path
      );
    } else {
      // テキストモード
      tweetId = await postTextTweet(freshTokens.access_token, PENALTY_TEXT);
    }

    // =====================================================
    // 4. DBに投稿結果を記録
    // =====================================================
    await supabase
      .from('habit_logs')
      .update({
        penalty_tweet_id: tweetId,
        penalty_executed_at: new Date().toISOString(),
      })
      .eq('id', log_id);

    // =====================================================
    // 5. プッシュ通知
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
async function postTextTweet(accessToken: string, text: string): Promise<string | null> {
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
    console.error('ツイート投稿失敗:', errText);
    return null;
  }

  const data = await res.json() as { data: { id: string } };
  return data.data.id;
}

/**
 * 自撮り写真付きのツイートを投稿する
 */
async function postSelfie(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  accessToken: string,
  storagePath: string
): Promise<string | null> {
  // Supabase Storageから画像を取得
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('selfies')
    .download(storagePath);

  if (downloadError || !fileData) {
    console.error('自撮り画像取得エラー:', downloadError);
    // 自撮り失敗時はテキストのみで投稿
    return postTextTweet(accessToken, PENALTY_TEXT);
  }

  // X media/upload に画像をアップロード (v1.1)
  const formData = new FormData();
  formData.append('media', fileData, 'penalty.jpg');

  const mediaRes = await fetch(X_MEDIA_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!mediaRes.ok) {
    const errText = await mediaRes.text();
    console.error('メディアアップロード失敗:', errText);
    return postTextTweet(accessToken, PENALTY_TEXT);
  }

  const mediaData = await mediaRes.json() as { media_id_string: string };

  // 画像付きツイートを投稿
  const tweetText = `[自撮り写真] ${PENALTY_TEXT}`;
  const res = await fetch(X_TWEETS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      text: tweetText,
      media: { media_ids: [mediaData.media_id_string] },
    }),
  });

  if (!res.ok) {
    console.error('自撮りツイート投稿失敗');
    return null;
  }

  const data = await res.json() as { data: { id: string } };
  return data.data.id;
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
