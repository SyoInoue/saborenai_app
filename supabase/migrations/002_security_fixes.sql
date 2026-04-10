-- =====================================================
-- セキュリティ修正マイグレーション
-- =====================================================

-- =====================================================
-- 修正1: users_insert_service ポリシーを削除
-- Edge FunctionはSERVICE_ROLEキーを使うのでRLSをバイパスする。
-- このポリシーは不要かつ危険（匿名ユーザーもINSERT可能になってしまう）
-- =====================================================
DROP POLICY IF EXISTS "users_insert_service" ON public.users;

-- =====================================================
-- 修正2: logs_update_service ポリシーを削除
-- USING(true) は認証済みの全ユーザーが他人のログを更新できてしまう。
-- Edge FunctionはSERVICE_ROLEキーでRLSをバイパスするため不要。
-- =====================================================
DROP POLICY IF EXISTS "logs_update_service" ON public.habit_logs;

-- =====================================================
-- 修正3: users_update_own に WITH CHECK を追加
-- is_pro・pro_expires_at はクライアントから変更不可にする。
-- （課金処理はEdge Function / RevenueCat Webhookのみが行う）
-- =====================================================
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- is_pro の改ざんを禁止
    AND is_pro IS NOT DISTINCT FROM (
      SELECT is_pro FROM public.users WHERE id = auth.uid()
    )
    -- pro_expires_at の改ざんを禁止
    AND pro_expires_at IS NOT DISTINCT FROM (
      SELECT pro_expires_at FROM public.users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 修正4: habit_logs の DELETE ポリシー追加
-- ログの削除はユーザー自身のみ許可
-- =====================================================
DROP POLICY IF EXISTS "logs_delete_own" ON public.habit_logs;

CREATE POLICY "logs_delete_own" ON public.habit_logs
  FOR DELETE USING (auth.uid() = user_id);
