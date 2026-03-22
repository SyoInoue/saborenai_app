# サボれない習慣化アプリ

## プロジェクト概要

習慣をサボったらユーザーのXアカウントに恥ずかしい投稿が自動で行われる、ペナルティ駆動型の習慣化iOSアプリ。

## 技術スタック

- **フロントエンド**: React Native (Expo Managed Workflow / SDK 52+)
- **バックエンド**: Supabase (Auth, Database, Edge Functions, Storage)
- **広告SDK**: Google AdMob (`react-native-google-mobile-ads`)
- **課金**: RevenueCat (`react-native-purchases`) ※ App Store課金をラップ
- **外部API**: X API v2 (OAuth 2.0 PKCE + tweet投稿)
- **言語**: TypeScript (strict mode)

## ドキュメント構成

詳細仕様は `.claude/` 配下を参照:

| ファイル | 内容 |
|---------|------|
| `.claude/prd.md` | プロダクト要件定義（機能・画面・フロー） |
| `.claude/tech-design.md` | 技術設計（DB・API・アーキテクチャ） |
| `.claude/tasks.md` | 実装タスク（順番通りに進める） |
| `.claude/rules.md` | コーディングルール・命名規則 |
| `.claude/x-api-setup.md` | X API取得・OAuth設定の手順書 |

## 開発の進め方

1. まず `.claude/tasks.md` のタスクを上から順番に実行する
2. 各タスクの実装前に `.claude/prd.md` と `.claude/tech-design.md` の該当セクションを確認する
3. コーディング時は `.claude/rules.md` のルールに従う
4. X API連携の実装前に `.claude/x-api-setup.md` を参照する

## プロジェクト初期化コマンド

```bash
npx create-expo-app@latest saborenai_app --template blank-typescript
cd saborenai_app
npx expo install expo-router expo-linking expo-constants expo-status-bar
npx expo install @supabase/supabase-js react-native-url-polyfill
npx expo install expo-notifications expo-camera expo-image-picker expo-secure-store
npx expo install react-native-google-mobile-ads react-native-purchases
```

## ディレクトリ構成（目標）

```
saborenai_app/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout (AuthProvider, AdMob init)
│   ├── index.tsx                 # エントリ → onboarding or home へ振り分け
│   ├── (auth)/
│   │   ├── onboarding.tsx        # オンボーディング3スライド
│   │   └── login.tsx             # X OAuth ログイン
│   ├── (tabs)/
│   │   ├── _layout.tsx           # タブナビゲーション
│   │   ├── home.tsx              # ホーム（タスク一覧）
│   │   ├── history.tsx           # 履歴・ストリーク
│   │   └── settings.tsx          # 設定・課金・アカウント
│   └── (modals)/
│       ├── add-habit.tsx         # 習慣追加モーダル
│       ├── penalty-setup.tsx     # ペナルティ設定
│       └── selfie-capture.tsx    # 自撮り撮影画面
├── src/
│   ├── components/               # 共通UIコンポーネント
│   │   ├── HabitCard.tsx
│   │   ├── StreakBadge.tsx
│   │   ├── CountdownTimer.tsx
│   │   ├── BannerAd.tsx
│   │   └── ProBadge.tsx
│   ├── hooks/                    # カスタムフック
│   │   ├── useAuth.ts
│   │   ├── useHabits.ts
│   │   ├── usePurchase.ts
│   │   └── useNotifications.ts
│   ├── lib/                      # ユーティリティ・クライアント
│   │   ├── supabase.ts
│   │   ├── x-api.ts
│   │   └── admob.ts
│   ├── providers/                # Context Providers
│   │   ├── AuthProvider.tsx
│   │   └── PurchaseProvider.tsx
│   ├── types/                    # 型定義
│   │   └── index.ts
│   └── constants/                # 定数
│       └── config.ts
├── supabase/
│   ├── migrations/               # DBマイグレーション
│   │   └── 001_initial.sql
│   └── functions/                # Edge Functions
│       ├── check-deadline/
│       │   └── index.ts
│       └── post-penalty/
│           └── index.ts
├── assets/                       # 画像・フォント
├── app.json                      # Expo設定
├── tsconfig.json
├── CLAUDE.md                     # ← このファイル
└── .claude/                      # Claude Code用ドキュメント
```
