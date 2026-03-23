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
      console.log('[Login] 1. OAuthフロー開始');
      const result = await startXOAuthFlow();
      if (!result) {
        console.log('[Login] キャンセルされました');
        return;
      }
      console.log('[Login] 2. OAuthフロー完了');

      const { code, codeVerifier } = result;

      console.log('[Login] 3. Edge Function呼び出し');
      const { data, error } = await supabase.functions.invoke('x-oauth-callback', {
        body: { code, codeVerifier },
      });

      if (error) {
        console.error('Edge Functionエラー:', JSON.stringify(error));
        const context = error.context as { text?: () => Promise<string> } | undefined;
        if (context?.text) {
          const body = await context.text();
          console.error('Edge Functionレスポンスボディ:', body);
        }
        throw new Error(error.message);
      }
      console.log('[Login] 4. Edge Function成功');

      // setSession は React Native で AsyncStorage ロック競合が起きるため
      // email + ワンタイムパスワードを受け取り signInWithPassword で直接ログイン
      const { email, password, user_id } = data as {
        email: string;
        password: string;
        user_id: string;
      };

      console.log('[Login] 5. signInWithPassword開始');
      const { error: sessionError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (sessionError) {
        throw new Error(sessionError.message);
      }
      console.log('[Login] 6. signInWithPassword完了');


      console.log('[Login] 7. usersテーブル取得');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user_id)
        .single();
      console.log('[Login] 8. usersテーブル取得完了', userData, userError);

      if (userData?.onboarding_completed) {
        console.log('[Login] 9. ホームへ遷移');
        router.replace('/(tabs)/home');
      } else {
        console.log('[Login] 9. penalty-setupへ遷移');
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
