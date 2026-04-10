/**
 * ホーム画面
 */

import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/providers/AuthProvider';
import { useHabits } from '@/hooks/useHabits';
import { useNotifications } from '@/hooks/useNotifications';
import { HabitCard } from '@/components/HabitCard';
import { BannerAd } from '@/components/BannerAd';
import { HabitCardSkeleton, StreakSkeleton } from '@/components/SkeletonLoader';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { consumePendingToast } from '@/lib/pendingToast';
import { useDeletedHabits } from '@/providers/DeletedHabitsProvider';
import { COLORS, SPACING } from '@/constants/config';
import type { Habit, HabitWithLog, UserStreak, WeekDay } from '@/types';

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

function getFutureDateLabel(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = DAYS_JP[d.getDay()];
  return daysFromNow === 1 ? `明日（${m}/${day}）` : `${m}/${day}（${wd}）`;
}

type HomeListItem =
  | { key: string; type: 'sectionHeader'; label: string }
  | { key: string; type: 'todayHabit'; item: HabitWithLog }
  | { key: string; type: 'todayEmpty' }
  | { key: string; type: 'futureHabit'; habit: Habit };

const FutureHabitRow = memo(function FutureHabitRow({ habit }: { habit: Habit }) {
  return (
    <View style={styles.futureCard}>
      <View style={styles.futureAccentLine} />
      <View style={styles.futureInner}>
        <Text style={styles.futureName} numberOfLines={1}>{habit.name}</Text>
        <View style={styles.futureMeta}>
          <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.futureTime}>{habit.deadline_time.slice(0, 5)}</Text>
        </View>
      </View>
    </View>
  );
});

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { habits, todayHabitsWithLogs, isLoading, completeHabit, refetch, justPenalizedHabit, clearJustPenalized } = useHabits();
  const { scheduleReminders, registerForPushNotifications } = useNotifications();
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { deletedIds, clearDeleted } = useDeletedHabits();
  const { toast, showToast, hideToast } = useToast();

  const fetchStreak = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const startStr = start.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('habit_logs')
      .select('target_date, completed_at, penalty_triggered, penalty_executed_at')
      .eq('user_id', user.id)
      .gte('target_date', startStr)
      .lte('target_date', todayStr);

    if (error || !data) return;

    // 日付ごとにグループ化
    const byDate = new Map<string, typeof data>();
    for (const log of data) {
      if (!byDate.has(log.target_date)) byDate.set(log.target_date, []);
      byDate.get(log.target_date)!.push(log);
    }

    // 今日から遡って連続達成日数を計算
    let streakCount = 0;
    const check = new Date(today);

    for (let i = 0; i < 366; i++) {
      const dateStr = check.toISOString().split('T')[0];
      const logs = byDate.get(dateStr);

      if (!logs || logs.length === 0) {
        // 習慣がない日 → 今日はスキップ、過去なら終了
        if (dateStr === todayStr) {
          check.setDate(check.getDate() - 1);
          continue;
        }
        break;
      }

      const hasAnyPenalty = logs.some(
        l => l.penalty_triggered || l.penalty_executed_at !== null
      );
      const hasAnyCompletion = logs.some(l => l.completed_at !== null);

      if (hasAnyPenalty) break; // ペナルティがあればリセット

      if (!hasAnyCompletion) {
        // まだ完了なし → 今日はスキップ、過去なら終了
        if (dateStr === todayStr) {
          check.setDate(check.getDate() - 1);
          continue;
        }
        break;
      }

      streakCount++;
      check.setDate(check.getDate() - 1);
    }

    setStreak({
      user_id: user.id,
      current_streak: streakCount,
      total_completed: data.filter(l => l.completed_at !== null).length,
    });
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), fetchStreak()]);
    } catch {
      showToast('更新に失敗しました', 'error');
    }
    setIsRefreshing(false);
  }, [refetch, fetchStreak]);

  const handleComplete = useCallback(async (logId: string) => {
    try {
      await completeHabit(logId);
      showToast('完了しました！', 'success');
    } catch {
      showToast('完了の記録に失敗しました', 'error');
    }
  }, [completeHabit, showToast]);

  useEffect(() => { fetchStreak(); }, [user, fetchStreak]);

  // 習慣リストが更新されたら通知をスケジュール
  useEffect(() => {
    if (todayHabitsWithLogs.length > 0) {
      scheduleReminders(todayHabitsWithLogs);
    }
  }, [todayHabitsWithLogs]);

  // 初回起動時に通知権限を取得
  useEffect(() => {
    registerForPushNotifications();
  }, [user]);

  useEffect(() => {
    if (!justPenalizedHabit) return;
    const timer = setTimeout(() => clearJustPenalized(), 3000);
    return () => clearTimeout(timer);
  }, [justPenalizedHabit]);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        await refetch();
        clearDeleted();
      };
      run();
      fetchStreak();
      const pending = consumePendingToast();
      if (pending) showToast(pending.message, pending.type);
    }, [refetch])
  );

  const visibleHabits = useMemo(
    () => todayHabitsWithLogs.filter((item) => !deletedIds.has(item.habit.id)),
    [todayHabitsWithLogs, deletedIds]
  );

  const listData = useMemo((): HomeListItem[] => {
    const items: HomeListItem[] = [];

    // TODAY セクション
    items.push({ key: 'header-today', type: 'sectionHeader', label: 'TODAY' });
    if (visibleHabits.length === 0) {
      items.push({ key: 'today-empty', type: 'todayEmpty' });
    } else {
      visibleHabits.forEach((item) =>
        items.push({ key: `today-${item.habit.id}`, type: 'todayHabit', item })
      );
    }

    // 明日〜6日後
    for (let i = 1; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dow = d.getDay() as WeekDay;
      const dayHabits = habits.filter((h) => h.repeat_days.includes(dow) && !deletedIds.has(h.id));
      if (dayHabits.length === 0) continue;
      items.push({ key: `header-day-${i}`, type: 'sectionHeader', label: getFutureDateLabel(i) });
      dayHabits.forEach((h) =>
        items.push({ key: `future-${i}-${h.id}`, type: 'futureHabit', habit: h })
      );
    }

    return items;
  }, [visibleHabits, habits, deletedIds]);

  const renderItem = useCallback(({ item }: { item: HomeListItem }) => {
    switch (item.type) {
      case 'sectionHeader':
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{item.label}</Text>
            <View style={styles.sectionLine} />
          </View>
        );
      case 'todayHabit':
        return <HabitCard item={item.item} onComplete={handleComplete} />;
      case 'todayEmpty':
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="add-circle-outline" size={56} color={COLORS.border} />
            <Text style={styles.emptyTitle}>習慣がありません</Text>
            <Text style={styles.emptyDescription}>右下の + から習慣を追加してください</Text>
          </View>
        );
      case 'futureHabit':
        return <FutureHabitRow habit={item.habit} />;
    }
  }, [handleComplete]);

  const currentStreak = streak?.current_streak ?? 0;

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

      {/* ペナルティ執行モーダル */}
      <Modal
        visible={!!justPenalizedHabit}
        transparent
        animationType="fade"
        onRequestClose={clearJustPenalized}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="flash" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>ペナルティ執行</Text>
            <View style={styles.modalDivider} />
            <Text style={styles.modalHabitName}>{justPenalizedHabit?.habitName}</Text>
            <Text style={styles.modalBody}>
              期限が切れたため{'\n'}Xに自動投稿されました
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={clearJustPenalized}>
              <Text style={styles.modalButtonText}>確認</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />

      <FlatList
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <>
            <PageHeader title="YARANEVA" />

            {/* ストリーク */}
            <View style={styles.streakContainer}>
              <View style={styles.streakLeft}>
                <Text style={styles.streakCount}>{currentStreak}</Text>
                <Text style={styles.streakUnit}>日連続達成</Text>
              </View>
              <View style={styles.streakRight}>
                <Ionicons
                  name={currentStreak > 0 ? 'flame' : 'moon'}
                  size={48}
                  color={currentStreak > 0 ? COLORS.primary : '#444444'}
                />
                <Text style={styles.streakLabel}>
                  {currentStreak > 0 ? '継続中' : '今日から始めよう'}
                </Text>
              </View>
            </View>
          </>
        }
        ListFooterComponent={<BannerAd />}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(modals)/add-habit')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
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
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  streakLeft: {
    flexDirection: 'column',
  },
  streakCount: {
    fontSize: 56,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: 60,
    letterSpacing: -2,
  },
  streakUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  streakRight: {
    alignItems: 'center',
    gap: 4,
  },
  streakLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 3,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  emptyDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2A0000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 4,
    marginBottom: SPACING.md,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    width: '100%',
    marginBottom: SPACING.md,
  },
  modalHabitName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl * 2,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  futureCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    opacity: 0.55,
    overflow: 'hidden',
  },
  futureAccentLine: {
    width: 3,
    backgroundColor: COLORS.border,
  },
  futureInner: {
    flex: 1,
    padding: SPACING.md,
  },
  futureName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  futureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  futureTime: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
