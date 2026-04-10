/**
 * 期限チェック Edge Function
 * pg_cronから毎分呼び出され、期限切れの未完了ログを検出してペナルティを発動する
 *
 * 環境変数:
 * - SUPABASE_URL: SupabaseプロジェクトURL
 * - SERVICE_ROLE_KEY: Supabaseサービスロールキー
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS はブラウザからの直接呼び出しには不要（pg_cronからのサーバー間通信のみ）
// 念のため同一オリジンのみ許可
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SUPABASE_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // pg_cronから受け取ったAuthorizationをそのままpost-penaltyに転送する（SUPABASE_SERVICE_ROLE_KEYは直接使えないため）
  const incomingAuth = req.headers.get('Authorization') ?? `Bearer ${serviceRoleKey}`;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 期限切れ & 未完了 & ペナルティ未発動 & 習慣が有効なログを取得
    // habits!inner で JOIN し is_active=false（削除済み）の習慣はスキップ
    const { data: overdueLog, error: fetchError } = await supabase
      .from('habit_logs')
      .select('id, user_id, habit_id, habits!inner(is_active)')
      .lte('deadline_at', new Date().toISOString())
      .is('completed_at', null)
      .eq('penalty_triggered', false)
      .eq('habits.is_active', true);

    if (fetchError) {
      console.error('期限切れログ取得エラー:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!overdueLog || overdueLog.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const logIds = overdueLog.map((l: { id: string }) => l.id);

    // penalty_triggered を true に更新（二重発動防止）
    const { error: updateError } = await supabase
      .from('habit_logs')
      .update({ penalty_triggered: true })
      .in('id', logIds);

    if (updateError) {
      console.error('ペナルティフラグ更新エラー:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 各ログに対してpost-penaltyを呼び出す（サービスロールキーで認証）
    const results = await Promise.allSettled(
      overdueLog.map(async (log: { id: string; user_id: string }) => {
        const res = await fetch(`${supabaseUrl}/functions/v1/post-penalty`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': incomingAuth,
          },
          // user_idはlog_idから導出させるため渡さない（信頼できるのはlog_idのみ）
          body: JSON.stringify({ log_id: log.id }),
        });
        const body = await res.text();
        if (!res.ok) {
          console.error(`post-penalty失敗 log_id=${log.id} status=${res.status}:`, body);
          throw new Error(`status=${res.status}`);
        }
        console.log(`post-penalty成功 log_id=${log.id}:`, body);
        return body;
      })
    );

    const processed = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`ペナルティ処理完了: ${processed}件成功, ${failed}件失敗`);

    return new Response(
      JSON.stringify({ processed, failed }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('予期しないエラー:', error);
    return new Response(
      JSON.stringify({ error: '内部サーバーエラー' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
