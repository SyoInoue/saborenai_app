/**
 * ホーム画面
 * ストリーク + 今日のタスクカード一覧 + FAB + バナー広告
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useHabits } from '@/hooks/useHabits';
import { HabitCard } from '@/components/HabitCard';
import { BannerAd } from '@/components/BannerAd';
import { HabitCardSkeleton, StreakSkeleton } from '@/components/SkeletonLoader';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { COLORS, SPACING } from '@/constants/config';
import type { UserStreak } from '@/types';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { todayHabitsWithLogs, isLoading, completeHabit, refetch } = useHabits();
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast, showToast, hideToast } = useToast();

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
    try {
      await Promise.all([refetch(), fetchStreak()]);
    } catch {
      showToast('更新に失敗しました', 'error');
    }
    setIsRefreshing(false);
  };

  const handleComplete = async (logId: string) => {
    try {
      await completeHabit(logId);
      showToast('完了しました！🎉', 'success');
    } catch {
      showToast('完了の記録に失敗しました', 'error');
    }
  };

  useEffect(() => {
    fetchStreak();
  }, [user]);

  // モーダルから戻ってきた時（習慣追加後など）に最新データを取得
  useFocusEffect(
    useCallback(() => {
      refetch();
      fetchStreak();
    }, [refetch])
  );

  const currentStreak = streak?.current_streak ?? 0;

  // スケルトンローディング表示
  if (isLoading) {
    return (
      <View style={[styles.container, styles.listContent]}>
        <StreakSkeleton />
        <HabitCardSkeleton />
        <HabitCardSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
      <FlatList
        data={todayHabitsWithLogs}
        keyExtractor={(item) => item.habit.id}
        renderItem={({ item }) => (
          <HabitCard item={item} onComplete={handleComplete} />
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
        ListFooterComponent={<BannerAd />}
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
