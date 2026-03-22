/**
 * X OAuth コールバック Edge Function
 * PKCE認証コードをアクセストークンに交換し、ユーザー情報をDBに保存する
 *
 * 環境変数:
 * - X_CLIENT_ID: XのOAuthクライアントID
 * - X_CLIENT_SECRET: XのOAuthクライアントシークレット
 * - SUPABASE_URL: SupabaseプロジェクトURL
 * - SERVICE_ROLE_KEY: Supabaseサービスロールキー
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const X_USERS_ME_URL = 'https://api.twitter.com/2/users/me';
const X_REDIRECT_URI = 'saboapp://oauth/callback';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface XUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

Deno.serve(async (req: Request) => {
  // CORSプリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, codeVerifier } = await req.json() as {
      code: string;
      codeVerifier: string;
    };

    if (!code || !codeVerifier) {
      return new Response(
        JSON.stringify({ error: 'code と codeVerifier が必要です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = Deno.env.get('X_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('X_CLIENT_SECRET') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';

    // =====================================================
    // 1. アクセストークンの取得
    // =====================================================
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: X_REDIRECT_URI,
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('トークン交換エラー:', errText);
      return new Response(
        JSON.stringify({ error: 'Xトークン交換に失敗しました', detail: errText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenRes.json() as TokenResponse;

    // =====================================================
    // 2. ユーザー情報の取得
    // =====================================================
    const userRes = await fetch(
      `${X_USERS_ME_URL}?user.fields=profile_image_url`,
      {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      }
    );

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error('ユーザー情報取得エラー:', errText);
      return new Response(
        JSON.stringify({ error: 'Xユーザー情報取得に失敗しました' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: xUser } = await userRes.json() as { data: XUser };

    // =====================================================
    // 3. SupabaseにユーザーをUPSERT
    // =====================================================
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const tokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // users テーブルにUPSERT
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          x_user_id: xUser.id,
          x_username: xUser.username,
          x_display_name: xUser.name,
          x_avatar_url: xUser.profile_image_url ?? null,
          x_access_token: tokens.access_token,
          x_refresh_token: tokens.refresh_token,
          x_token_expires_at: tokenExpiresAt,
        },
        { onConflict: 'x_user_id' }
      );

    if (upsertError) {
      console.error('Upsertエラー:', upsertError);
      return new Response(
        JSON.stringify({ error: 'ユーザー保存に失敗しました' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 保存したユーザーのIDを取得
    const { data: savedUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('x_user_id', xUser.id)
      .single();

    if (selectError || !savedUser) {
      return new Response(
        JSON.stringify({ error: 'ユーザーIDの取得に失敗しました' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // 4. Supabase Auth にユーザーを登録/取得してJWTを発行
    // =====================================================
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: `${xUser.id}@x-user.saboapp.local`,
      options: {
        data: { user_id: savedUser.id },
      },
    });

    if (authError || !authData.properties) {
      console.error('Auth link生成エラー:', authError);
      return new Response(
        JSON.stringify({ error: 'Supabase認証トークンの生成に失敗しました' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // マジックリンクのハッシュからトークンを取得
    const hashed_token = authData.properties.hashed_token;
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.verifyOtp({
      type: 'magiclink',
      token_hash: hashed_token,
    });

    if (sessionError || !sessionData.session) {
      console.error('セッション生成エラー:', sessionError);
      return new Response(
        JSON.stringify({ error: 'セッション生成に失敗しました' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        user_id: savedUser.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('予期しないエラー:', error);
    return new Response(
      JSON.stringify({ error: '内部サーバーエラー' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
