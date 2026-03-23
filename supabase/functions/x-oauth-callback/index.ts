/**
 * X OAuth コールバック Edge Function
 * PKCE認証コードをアクセストークンに交換し、ユーザー情報をDBに保存する
 *
 * 重要: auth.users.id と users.id を必ず一致させること（RLS要件）
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
}

interface XUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, codeVerifier } = await req.json() as { code: string; codeVerifier: string };

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
    // 1. X アクセストークン取得
    // =====================================================
    const tokenRes = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: X_REDIRECT_URI,
        code_verifier: codeVerifier,
      }).toString(),
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
    // 2. X ユーザー情報取得
    // =====================================================
    const userRes = await fetch(`${X_USERS_ME_URL}?user.fields=profile_image_url`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error('ユーザー情報取得エラー:', errText);
      return new Response(
        JSON.stringify({ error: 'Xユーザー情報取得に失敗しました', detail: errText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: xUser } = await userRes.json() as { data: XUser };
    console.log('Xユーザー取得成功:', xUser.username);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // =====================================================
    // 3. Supabase Auth ユーザーを取得 or 作成（IDを先に確定）
    // =====================================================
    const email = `${xUser.id}@x-user.saboapp.local`;
    const password = `sabo-${xUser.id}-${clientSecret.slice(0, 12)}`;

    // 既存ユーザー検索
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = listData?.users?.find((u) => u.email === email);

    let authUserId: string;

    if (existingAuthUser) {
      // 既存ユーザー: パスワードを更新して確実にログインできるようにする
      authUserId = existingAuthUser.id;
      await supabase.auth.admin.updateUserById(authUserId, { password, email_confirm: true });
      console.log('既存authユーザー:', authUserId);
    } else {
      // 新規ユーザー作成
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { x_user_id: xUser.id },
      });
      if (createError || !newUser?.user) {
        console.error('Authユーザー作成エラー:', createError);
        return new Response(
          JSON.stringify({ error: 'Authユーザー作成に失敗しました', detail: createError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authUserId = newUser.user.id;
      console.log('新規authユーザー作成:', authUserId);
    }

    // =====================================================
    // 4. users テーブルに authUserId を id として UPSERT（RLS対応）
    // =====================================================
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // 古いレコード（x_user_idが同じだがidが違う）を削除してからUPSERT
    await supabase.from('users').delete().eq('x_user_id', xUser.id).neq('id', authUserId);

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: authUserId,           // auth.uid() と一致させる
          x_user_id: xUser.id,
          x_username: xUser.username,
          x_display_name: xUser.name,
          x_avatar_url: xUser.profile_image_url ?? null,
          x_access_token: tokens.access_token,
          x_refresh_token: tokens.refresh_token,
          x_token_expires_at: tokenExpiresAt,
        },
        { onConflict: 'id' }
      );

    if (upsertError) {
      console.error('usersテーブルUpsertエラー:', upsertError);
      return new Response(
        JSON.stringify({ error: 'ユーザー保存に失敗しました', detail: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // 5. セッション発行
    // =====================================================
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session) {
      console.error('サインインエラー:', signInError);
      return new Response(
        JSON.stringify({ error: 'サインインに失敗しました', detail: signInError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('ログイン成功:', authUserId);

    return new Response(
      JSON.stringify({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        user_id: authUserId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('予期しないエラー:', message);
    return new Response(
      JSON.stringify({ error: '内部サーバーエラー', detail: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
