/**
 * RevenueCat Webhook Edge Function
 * RevenueCatからの課金イベントを受け取り、users.is_pro を同期する
 *
 * 環境変数:
 * - REVENUECAT_WEBHOOK_SECRET: RevenueCatのWebhook署名シークレット
 * - SUPABASE_URL: SupabaseプロジェクトURL
 * - SERVICE_ROLE_KEY: Supabaseサービスロールキー
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Proを有効にするイベント */
const PRO_ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
]);

/** Proを無効にするイベント */
const PRO_INACTIVE_EVENTS = new Set([
  'EXPIRATION',
  'CANCELLATION',
  'BILLING_ISSUE',
]);

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  expiration_at_ms?: number;
}

interface WebhookPayload {
  event: RevenueCatEvent;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

  try {
    // Webhook認証（Authorization ヘッダーで検証）
    const authHeader = req.headers.get('Authorization');
    if (webhookSecret && authHeader !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: '認証失敗' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.json() as WebhookPayload;
    const { event } = payload;

    if (!event?.type || !event?.app_user_id) {
      return new Response(
        JSON.stringify({ error: '不正なペイロード' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`RevenueCatイベント受信: ${event.type} / user: ${event.app_user_id}`);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // イベントタイプに応じて is_pro を更新
    if (PRO_ACTIVE_EVENTS.has(event.type)) {
      const proExpiresAt = event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null;

      const { error } = await supabase
        .from('users')
        .update({ is_pro: true, pro_expires_at: proExpiresAt })
        .eq('id', event.app_user_id);

      if (error) {
        console.error('Pro有効化エラー:', error);
        return new Response(
          JSON.stringify({ error: 'DB更新失敗' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`ユーザー ${event.app_user_id} をProに昇格`);

    } else if (PRO_INACTIVE_EVENTS.has(event.type)) {
      const { error } = await supabase
        .from('users')
        .update({ is_pro: false, pro_expires_at: null })
        .eq('id', event.app_user_id);

      if (error) {
        console.error('Pro無効化エラー:', error);
        return new Response(
          JSON.stringify({ error: 'DB更新失敗' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`ユーザー ${event.app_user_id} のProを無効化`);

    } else {
      // 対象外イベントはスキップ
      console.log(`スキップ: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
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
