/**
 * 認証プロバイダー
 * Supabase Authのセッションを管理し、アプリ全体にユーザー情報を配信する
 */

import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { supabase } from '@/lib/supabase';
import type { AuthContextType, User } from '@/types';

// =====================================================
// コンテキスト定義
// =====================================================

const AuthContext = createContext<AuthContextType | null>(null);

// =====================================================
// 状態管理
// =====================================================

type AuthState = {
  user: User | null;
  isLoading: boolean;
};

type AuthAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

// =====================================================
// AuthProvider コンポーネント
// =====================================================

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isLoading: true,
  });

  /**
   * Supabaseセッションからユーザープロファイルを取得する
   */
  const fetchUser = async (userId: string): Promise<void> => {
    // x_access_token / x_refresh_token はサーバー側（Edge Function）のみが使用する機密情報。
    // クライアントには返さない（万が一のリーク・メモリダンプ対策）
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, x_user_id, x_username, x_display_name, x_avatar_url, ' +
        'penalty_type, is_pro, pro_expires_at, ' +
        'expo_push_token, onboarding_completed, created_at, updated_at'
      )
      .eq('id', userId)
      .single();

    if (error) {
      // ユーザーがDBに存在しない場合は古いセッションを破棄してサインアウト
      if (error.code === 'PGRST116') {
        await supabase.auth.signOut();
      }
      dispatch({ type: 'SET_USER', payload: null });
      return;
    }

    dispatch({ type: 'SET_USER', payload: data as User });
  };

  /**
   * ユーザー情報を再取得する（外部から呼び出し可能）
   */
  const refreshUser = async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await fetchUser(session.user.id);
    }
  };

  /**
   * サインアウト処理
   */
  const signOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // sign out error is non-fatal; clear local user state regardless
    }
    dispatch({ type: 'SET_USER', payload: null });
  };

  // セッション変化を監視
  useEffect(() => {
    // 初期セッション確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        fetchUser(session.user.id);
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });

    // セッション変化リスナー
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user?.id) {
          await fetchUser(session.user.id);
        } else {
          dispatch({ type: 'SET_USER', payload: null });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user: state.user,
    isLoading: state.isLoading,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =====================================================
// カスタムフック
// =====================================================

/**
 * 認証コンテキストを使用するカスタムフック
 * AuthProvider外での使用はエラーを投げる
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth は AuthProvider 内で使用してください');
  }
  return context;
}
