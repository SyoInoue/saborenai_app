/**
 * X OAuth ログイン画面
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { startXOAuthFlow } from '@/lib/x-api';
import { COLORS, SPACING } from '@/constants/config';

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleXLogin = async () => {
    setIsLoading(true);
    try {
      const result = await startXOAuthFlow();
      if (!result) return;

      const { code, codeVerifier } = result;

      const { data, error } = await supabase.functions.invoke('x-oauth-callback', {
        body: { code, codeVerifier },
      });

      if (error) {
        throw new Error(error.message);
      }

      const { email, password, user_id } = data as {
        email: string;
        password: string;
        user_id: string;
      };

      const { error: sessionError } = await supabase.auth.signInWithPassword({ email, password });
      if (sessionError) throw new Error(sessionError.message);

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
    } catch {
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
      {/* 背景ロゴ */}
      <Image
        source={require('../../assets/yaraneva_bg_overlay.png')}
        style={styles.bgOverlay}
        resizeMode="cover"
      />

      {/* ロゴエリア */}
      <View style={styles.heroArea}>
        <Text style={styles.appNameSub}>サボれない習慣化アプリ</Text>
        <Text style={styles.appName}>YARANEVA</Text>
        <View style={styles.taglineRow}>
          <View style={styles.taglineLine} />
          <Text style={styles.tagline}>サボったら自動投稿される</Text>
          <View style={styles.taglineLine} />
        </View>
      </View>

      {/* ボトムエリア */}
      <View style={styles.bottom}>
        <View style={styles.divider} />

        <Text style={styles.loginLabel}>Xアカウントで連携してログイン</Text>

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
              <Text style={styles.xButtonText}>X でログイン</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.notice}>
          ログインすることで{' '}
          <Text
            style={styles.noticeLink}
            onPress={() => Linking.openURL('https://syoinoue.github.io/yaraneva-legal/terms-of-service.html')}
          >利用規約</Text>
          {' '}と{' '}
          <Text
            style={styles.noticeLink}
            onPress={() => Linking.openURL('https://syoinoue.github.io/yaraneva-legal/privacy-policy.html')}
          >プライバシーポリシー</Text>
          {' '}に同意したものとみなされます
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
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.38,
  },
  heroArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  appNameSub: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  appName: {
    fontSize: 56,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -1,
    lineHeight: 60,
    marginBottom: SPACING.lg,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  taglineLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  tagline: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  bottom: {
    padding: SPACING.xl,
    paddingBottom: 48,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  loginLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: SPACING.md,
    letterSpacing: 0.5,
  },
  xButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    minHeight: 52,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  xIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  xButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    flex: 1,
  },
  notice: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  noticeLink: {
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
