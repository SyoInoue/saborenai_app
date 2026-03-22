/**
 * 期限チェック Edge Function
 * pg_cronから毎分呼び出され、期限切れの未完了ログを検出してペナルティを発動する
 *
 * 環境変数:
 * - SUPABASE_URL: SupabaseプロジェクトURL
 * - SERVICE_ROLE_KEY: Supabaseサービスロールキー
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 期限切れ & 未完了 & ペナルティ未発動のログを取得
    const { data: overdueLog, error: fetchError } = await supabase
      .from('habit_logs')
      .select('id, user_id, habit_id')
      .lte('deadline_at', new Date().toISOString())
      .is('completed_at', null)
      .eq('penalty_triggered', false);

    if (fetchError) {
      console.error('期限切れログ取得エラー:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!overdueLog || overdueLog.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 各ログに対してpost-penaltyを呼び出す
    const results = await Promise.allSettled(
      overdueLog.map((log: { id: string; user_id: string }) =>
        fetch(`${supabaseUrl}/functions/v1/post-penalty`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ log_id: log.id, user_id: log.user_id }),
        })
      )
    );

    const processed = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`ペナルティ処理完了: ${processed}件成功, ${failed}件失敗`);

    return new Response(
      JSON.stringify({ processed, failed }),
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
