# 実装タスク: サボれない習慣化アプリ

> **このタスクリストを上から順番に実行すること。**
> 各タスク完了後に動作確認してから次へ進む。

## Phase 0: プロジェクト初期化

### Task 0-1: Expoプロジェクト作成
```bash
npx create-expo-app@latest saborenai_app --template blank-typescript
cd saborenai_app
```

### Task 0-2: 依存パッケージインストール
```bash
npx expo install expo-router expo-linking expo-constants expo-status-bar react-native-screens react-native-safe-area-context
npx expo install @supabase/supabase-js react-native-url-polyfill @react-native-async-storage/async-storage
npx expo install expo-notifications expo-camera expo-image-picker expo-secure-store expo-web-browser expo-crypto
npx expo install react-native-google-mobile-ads react-native-purchases
npx expo install expo-linear-gradient
```

### Task 0-3: app.json 設定
- `scheme: "saboapp"` を追加（OAuth redirect用）
- `plugins` にexpo-router, expo-camera, expo-notifications, react-native-google-mobile-adsを追加
- `ios.bundleIdentifier`: `com.inouesyo.saboapp`
- `ios.infoPlist` にカメラ使用理由を追加

### Task 0-4: ディレクトリ構成作成
CLAUDE.mdに記載のディレクトリ構成を作成。空ファイルでOK。

### Task 0-5: TypeScript & ESLint設定
- `tsconfig.json` strictモード有効化
- パスエイリアス `@/` → `src/`

---

## Phase 1: 認証 & 基盤

### Task 1-1: Supabaseクライアント初期化
`src/lib/supabase.ts` を作成。AsyncStorageでセッション永続化。

### Task 1-2: DBマイグレーション作成
`supabase/migrations/001_initial.sql` に tech-design.md のSQL定義をすべて記述。

### Task 1-3: 型定義
`src/types/index.ts` にDB型をTypeScriptで定義。

### Task 1-4: AuthProvider実装
`src/providers/AuthProvider.tsx` でSupabase AuthセッションをContext配信。

### Task 1-5: Root Layout実装
`app/_layout.tsx` でAuthProviderとPurchaseProviderをラップ。

### Task 1-6: エントリ画面
`app/index.tsx` で認証状態に応じて振り分け。

---

## Phase 2: オンボーディング & X OAuth

### Task 2-1: オンボーディング画面
`app/(auth)/onboarding.tsx` - 3スライドスワイプUI。

### Task 2-2: X OAuth ログイン画面
`app/(auth)/login.tsx` - expo-web-browserでX認証、PKCE実装。

### Task 2-3: X OAuth トークン交換 Edge Function
`supabase/functions/x-oauth-callback/index.ts` - token交換・ユーザー情報保存。

### Task 2-4: ペナルティ設定画面
`app/(modals)/penalty-setup.tsx` - テキスト/自撮りモード選択。

### Task 2-5: 自撮り撮影画面
`app/(modals)/selfie-capture.tsx` - インカメラ撮影→Storage保存。

---

## Phase 3: コア機能（習慣 & ペナルティ）

### Task 3-1: 習慣追加モーダル
`app/(modals)/add-habit.tsx` - 無料1個制限チェック付き。

### Task 3-2: useHabits カスタムフック
`src/hooks/useHabits.ts` - CRUD + リアルタイムサブスクリプション。

### Task 3-3: ホーム画面
`app/(tabs)/home.tsx` - ストリーク + タスクカード + FAB + バナー広告。

### Task 3-4: HabitCard コンポーネント
`src/components/HabitCard.tsx` - カウントダウン + 完了ボタン + 状態表示。

### Task 3-5: habit_log自動生成
アプリ起動時にクライアント側で当日分をUPSERT（方法A推奨）。

### Task 3-6: ペナルティ判定 Edge Function
`supabase/functions/check-deadline/index.ts`

### Task 3-7: ペナルティ投稿 Edge Function
`supabase/functions/post-penalty/index.ts`

### Task 3-8: pg_cron設定
毎分実行cronジョブをマイグレーションに追加。

---

## Phase 4: 通知

### Task 4-1: useNotifications フック
通知許可 + expo_push_token取得 + ローカル通知スケジュール。

### Task 4-2: リマインダー通知
期限30分前ローカル通知。完了時キャンセル。

### Task 4-3: ペナルティ通知（サーバーサイド）
post-penalty内でExpo Push API呼び出し。

---

## Phase 5: マネタイズ

### Task 5-1: RevenueCat初期化
`src/providers/PurchaseProvider.tsx`

### Task 5-2: usePurchase フック
`src/hooks/usePurchase.ts` - isPro取得・購入・リストア。

### Task 5-3: Pro誘導UI
上限チェック + アップグレードモーダル + 設定画面。

### Task 5-4: AdMob バナー広告
`src/components/BannerAd.tsx` - isPro出し分け。

### Task 5-5: RevenueCat Webhook Edge Function
`supabase/functions/revcat-webhook/index.ts`

---

## Phase 6: 追加画面 & 仕上げ

### Task 6-1: 履歴画面
`app/(tabs)/history.tsx` - カレンダー + 達成率。

### Task 6-2: 設定画面
`app/(tabs)/settings.tsx`

### Task 6-3: タブナビゲーション
`app/(tabs)/_layout.tsx` - 3タブ。

### Task 6-4: エラーハンドリング
API失敗時のトースト、token切れ再認証フロー。

### Task 6-5: ローディング & 空状態
スケルトン、空状態UI。

---

## Phase 7: テスト & デプロイ準備

### Task 7-1: 動作確認チェックリスト
- [ ] 新規ユーザー登録〜オンボーディング完了
- [ ] X OAuth認証 → トークン保存
- [ ] 習慣追加（無料1個制限の確認）
- [ ] 完了ボタン → DB記録
- [ ] 期限切れ → ペナルティ投稿（テキスト）
- [ ] 期限切れ → ペナルティ投稿（自撮り）
- [ ] リマインダー通知
- [ ] ペナルティ通知
- [ ] ストリーク計算
- [ ] Pro課金 → 広告非表示 & スロット拡張
- [ ] ログアウト → 再ログイン

### Task 7-2: App Store提出準備
- App Store Connectでアプリ登録
- スクリーンショット作成
- プライバシーポリシー・利用規約作成
