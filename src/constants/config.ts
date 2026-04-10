/**
 * アプリ全体で使用する定数・設定値
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const X_CLIENT_ID = process.env.EXPO_PUBLIC_X_CLIENT_ID ?? '';

/** X OAuth 2.0 設定 */
export const X_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
export const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
export const X_REDIRECT_URI = 'saboapp://oauth/callback';
export const X_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

/** カラーパレット — ダーク × レッド テーマ */
export const COLORS = {
  primary: '#C41230',       // メインレッド（深みのある落ち着いた赤）
  secondary: '#C41230',     // セカンダリ（プロバッジ等）
  background: '#161616',    // ダーク背景（真っ黒より少し明るく）
  surface: '#202020',       // カード・シート背景
  surfaceElevated: '#2A2A2A', // 浮き上がり要素
  text: '#FFFFFF',          // プライマリテキスト
  textSecondary: '#C0C0C0', // サブテキスト
  textMuted: '#888888',     // 最暗テキスト
  danger: '#C41230',        // 危険・エラー（primaryと統一）
  success: '#00C853',       // 達成・成功
  warning: '#FF6D00',       // 警告（カウントダウン切迫）
  border: '#2A2A2A',        // 細ボーダー
  borderBright: '#3A3A3A',  // 少し明るいボーダー
} as const;

/** スペーシング */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** 習慣スロット上限 */
export const HABIT_LIMIT_FREE = 1;
export const HABIT_LIMIT_PRO = 10;

/** RevenueCat商品ID */
export const REVENUECAT_PRO_PRODUCT_ID_MONTHLY = 'pro_monthly';
export const REVENUECAT_PRO_PRODUCT_ID_YEARLY = 'pro_yearly';

/** ペナルティタイプ */
export const PENALTY_TYPE_TEXT = 'text' as const;

/** ペナルティツイートテキスト（ハッシュタグはサーバー側で自動付与） */
export const PENALTY_TWEET_TEXT = '私はサボりました。だらしのない人間です。';

/** AdMob テスト用ID (本番では差し替え) */
export const ADMOB_BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';
export const ADMOB_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
