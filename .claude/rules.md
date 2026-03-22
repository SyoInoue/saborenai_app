# コーディングルール: サボれない習慣化アプリ

## 1. 言語・フォーマット

- **TypeScript strict mode** を必ず使用
- `any` 型の使用禁止。`unknown` + 型ガードで対応
- セミコロンあり、シングルクォート、インデント2スペース
- ファイル末尾に改行

## 2. ファイル命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase.tsx | `HabitCard.tsx` |
| フック | camelCase.ts（use始まり） | `useHabits.ts` |
| ユーティリティ | camelCase.ts | `supabase.ts` |
| 型定義 | camelCase.ts | `index.ts` |
| 画面（Expo Router） | kebab-case.tsx | `add-habit.tsx` |
| Edge Function | kebab-case/index.ts | `post-penalty/index.ts` |

## 3. コンポーネント設計

- 関数コンポーネント + hooks のみ（class禁止）
- `export default` で画面コンポーネント（Expo Router要件）
- 共有コンポーネントは named export
- Propsは `type Props = { ... }` で同ファイル定義
- 150行以内目安。超える場合は分割

## 4. 状態管理

- グローバル: React Context + useReducer（Auth, Purchase）
- サーバー: Supabaseリアルタイムサブスクリプション
- ローカル: useState（UI状態のみ）
- Redux/Zustand等は使用しない

## 5. Supabase操作

- DB操作はカスタムフック内に閉じ込める
- RLS前提でuser_id検証を怠らない
- `const { data, error } = await ...` のerrorを必ずチェック
- 楽観的更新は使わない（MVP）

## 6. エラーハンドリング

- API呼び出しは必ず try-catch またはerrorチェック
- ユーザー向け: `Alert.alert()` 日本語表示
- 開発用: `console.error()` ログ
- Edge Function: 適切なHTTPステータスコード

## 7. スタイリング

- `StyleSheet.create()` 使用（インラインスタイル禁止）
- カラー・スペーシングは定数化

```typescript
// src/constants/config.ts
export const COLORS = {
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: '#1A1A2E',
  textSecondary: '#6C757D',
  danger: '#DC3545',
  success: '#28A745',
  border: '#E0E0E0',
} as const;

export const SPACING = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
} as const;
```

## 8. セキュリティ

- APIキー・シークレットはハードコード禁止
- Expo環境変数 or `.env` 経由で注入
- X OAuthのclient_secretはEdge Function環境変数
- 自撮りStorage: `selfies/{user_id}/penalty.jpg`（private）

## 9. Edge Function

- Deno runtime、`Deno.serve()` パターン
- CORSヘッダー設定
- 環境変数: `Deno.env.get()`
- レスポンスは必ずJSON

## 10. コメント

- 関数・フックにJSDocコメント必須
- 複雑ロジックに日本語インラインコメント
- `// TODO:` `// WHY:` 形式

## 11. Git

- プレフィックス: `feat:` `fix:` `refactor:` `docs:` `chore:`
- 1タスク = 1コミット目安
- メッセージは日本語OK
