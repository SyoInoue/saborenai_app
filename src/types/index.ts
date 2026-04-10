/**
 * アプリ全体の型定義
 */

/** ペナルティタイプ */
export type PenaltyType = 'text';

/** ユーザープロファイル（クライアント側・DBのusersテーブルの一部に対応）
 * NOTE: x_access_token / x_refresh_token は機密情報のためクライアントには返さない。
 *       これらはEdge Function（サーバー側）でのみ使用する。
 */
export interface User {
  id: string;
  x_user_id: string;
  x_username: string;
  x_display_name: string | null;
  x_avatar_url: string | null;
  penalty_type: PenaltyType;
  is_pro: boolean;
  pro_expires_at: string | null;
  expo_push_token: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

/** 曜日（0=日曜日, 1=月曜日, ... 6=土曜日） */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 習慣（DBのhabitsテーブルに対応） */
export interface Habit {
  id: string;
  user_id: string;
  name: string;
  deadline_time: string; // "HH:MM:SS" 形式
  repeat_days: WeekDay[];
  is_active: boolean;
  penalty_type: PenaltyType;
  penalty_text: string | null;
  created_at: string;
  updated_at: string;
}

/** 習慣ログ（DBのhabit_logsテーブルに対応） */
export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  target_date: string; // "YYYY-MM-DD" 形式
  deadline_at: string; // ISO 8601
  completed_at: string | null;
  penalty_triggered: boolean;
  penalty_tweet_id: string | null;
  penalty_executed_at: string | null;
  created_at: string;
}

/** ストリーク情報（DBのuser_streaksビューに対応） */
export interface UserStreak {
  user_id: string;
  total_completed: number;
  current_streak: number;
}

/** 習慣追加フォームの入力値 */
export interface HabitFormData {
  name: string;
  deadline_time: string; // "HH:MM" 形式
  repeat_days: WeekDay[];
  penalty_text: string | null;
}

/** 習慣カードの表示状態 */
export type HabitCardStatus = 'pending' | 'completed' | 'overdue' | 'penalized';

/** 習慣ログと習慣情報を結合した表示用データ */
export interface HabitWithLog {
  habit: Habit;
  log: HabitLog | null;
  status: HabitCardStatus;
}

/** X OAuthコールバックのパラメータ */
export interface XOAuthCallbackParams {
  code: string;
  state: string;
}

/** 認証コンテキストの型 */
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

/** Proプランの課金プラン */
export type ProPlan = 'monthly' | 'yearly';

/** 課金コンテキストの型 */
export interface PurchaseContextType {
  isPro: boolean;
  isLoading: boolean;
  purchasePro: (plan?: ProPlan) => Promise<void>;
  restorePurchases: () => Promise<void>;
}
