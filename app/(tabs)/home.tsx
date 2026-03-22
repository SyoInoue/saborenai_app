/**
 * ホーム画面
 * ストリーク + 今日のタスクカード一覧 + FAB + バナー広告
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { usePurchase } from '@/providers/PurchaseProvider';
import { useHabits } from '@/hooks/useHabits';
import { HabitCard } from '@/components/HabitCard';
import { supabase } from '@/lib/supabase';
import { COLORS, SPACING } from '@/constants/config';
import type { UserStreak } from '@/types';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPro } = usePurchase();
  const { todayHabitsWithLogs, isLoading, completeHabit, refetch } = useHabits();
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * ストリーク情報を取得する
   */
  const fetchStreak = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setStreak(data as UserStreak);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), fetchStreak()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchStreak();
  }, [user]);

  const currentStreak = streak?.current_streak ?? 0;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={todayHabitsWithLogs}
        keyExtractor={(item) => item.habit.id}
        renderItem={({ item }) => (
          <HabitCard item={item} onComplete={completeHabit} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={
          <>
            {/* ストリーク表示 */}
            <View style={styles.streakContainer}>
              <Text style={styles.streakEmoji}>
                {currentStreak > 0 ? '🔥' : '💤'}
              </Text>
              <View>
                <Text style={styles.streakCount}>{currentStreak}日連続</Text>
                <Text style={styles.streakLabel}>
                  {currentStreak > 0 ? '継続中！すごい！' : '今日から始めよう'}
                </Text>
              </View>
            </View>

            {/* 今日の習慣タイトル */}
            <Text style={styles.sectionTitle}>今日の習慣</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>今日の習慣はありません</Text>
            <Text style={styles.emptyDescription}>
              右下の+ボタンから習慣を追加しましょう
            </Text>
          </View>
        }
        ListFooterComponent={
          // バナー広告（Freeユーザーのみ）
          !isPro ? <View style={styles.adBanner}>
            <Text style={styles.adBannerText}>広告（Proプランで非表示）</Text>
          </View> : null
        }
      />

      {/* FAB（習慣追加ボタン） */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(modals)/add-habit')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 60,
    paddingBottom: 100,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  streakEmoji: {
    fontSize: 48,
  },
  streakCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  streakLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  adBanner: {
    backgroundColor: COLORS.surface,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
  },
  adBannerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: SPACING.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 38,
  },
});
