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

/** カラーパレット */
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
export const REVENUECAT_PRO_PRODUCT_ID = 'pro_monthly';

/** ペナルティタイプ */
export const PENALTY_TYPE_TEXT = 'text' as const;
export const PENALTY_TYPE_SELFIE = 'selfie' as const;

/** ペナルティツイートテキスト */
export const PENALTY_TWEET_TEXT =
  '私はサボりました。だらしのない人間です。 #サボれない習慣化アプリ';

/** AdMob テスト用ID (本番では差し替え) */
export const ADMOB_BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';
export const ADMOB_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
