/**
 * エントリ画面
 * 認証状態に応じてオンボーディングまたはホームに振り分ける
 */

import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { COLORS } from '@/constants/config';

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // 未認証 → オンボーディングへ
      router.replace('/(auth)/onboarding');
    } else if (!user.onboarding_completed) {
      // オンボーディング未完了 → ペナルティ設定へ
      router.replace('/(modals)/penalty-setup');
    } else {
      // 認証済み & オンボーディング完了 → ホームへ
      router.replace('/(tabs)/home');
    }
  }, [user, isLoading]);

  // ローディング中はスピナー表示
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
