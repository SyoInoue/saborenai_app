/**
 * X OAuth ログイン画面
 * expo-web-browserでX認証を実行し、PKCE フローでトークンを取得する
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { startXOAuthFlow } from '@/lib/x-api';
import { COLORS, SPACING } from '@/constants/config';

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * X OAuth ログインを実行する
   * コードをEdge Functionに送り、トークン交換とユーザー情報保存を行う
   */
  const handleXLogin = async () => {
    setIsLoading(true);
    try {
      // PKCE フローでXのOAuth認証を開始
      const result = await startXOAuthFlow();
      if (!result) {
        // ユーザーがキャンセルした場合は何もしない
        return;
      }

      const { code, codeVerifier } = result;

      // Edge Function にコードを送りトークン交換・ユーザー情報保存を依頼
      const { data, error } = await supabase.functions.invoke('x-oauth-callback', {
        body: { code, codeVerifier },
      });

      if (error) {
        console.error('Edge Functionエラー詳細:', JSON.stringify(error));
        // レスポンスボディも取得
        const context = error.context as { text?: () => Promise<string> } | undefined;
        if (context?.text) {
          const body = await context.text();
          console.error('Edge Functionレスポンスボディ:', body);
        }
        throw new Error(error.message);
      }

      // Edge FunctionからカスタムJWTを受け取りSupabaseにセッション設定
      const { access_token, refresh_token, user_id } = data as {
        access_token: string;
        refresh_token: string;
        user_id: string;
      };

      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      // ユーザー情報を取得してonboarding状態に応じてナビゲーション
      const { data: userData } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user_id)
        .single();

      if (userData?.onboarding_completed) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(modals)/penalty-setup');
      }
    } catch (error) {
      console.error('X OAuthエラー:', error);
      Alert.alert(
        'ログインエラー',
        'Xアカウントでのログインに失敗しました。もう一度お試しください。',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.primary, '#FF8E53']}
        style={styles.header}
      >
        <Text style={styles.emoji}>🔥</Text>
        <Text style={styles.appName}>サボれない</Text>
        <Text style={styles.tagline}>習慣化アプリ</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.title}>Xアカウントで{'\n'}ログイン</Text>
        <Text style={styles.subtitle}>
          ペナルティ投稿のためにXアカウントとの連携が必要です
        </Text>

        <TouchableOpacity
          style={[styles.xButton, isLoading && styles.buttonDisabled]}
          onPress={handleXLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.xIcon}>𝕏</Text>
              <Text style={styles.xButtonText}>Xでログイン</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.notice}>
          ※ ログインすることで利用規約とプライバシーポリシーに同意したものとみなされます
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flex: 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tagline: {
    fontSize: 20,
    color: '#FFFFFFCC',
    marginTop: SPACING.xs,
  },
  body: {
    flex: 0.55,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  xButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    width: '100%',
    gap: SPACING.sm,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  xIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  xButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  notice: {
    marginTop: SPACING.lg,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
