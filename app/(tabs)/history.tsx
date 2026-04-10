/**
 * 履歴画面
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { BannerAd } from '@/components/BannerAd';
import { COLORS, SPACING } from '@/constants/config';
import type { HabitLog } from '@/types';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const DEBUG_SCREENSHOT_MODE = process.env.EXPO_PUBLIC_DEBUG_SCREENSHOT_MODE === 'true';

// スクショ用モックデータ（2026年3月）
const MOCK_LOGS: HabitLog[] = [
  ...[3,5,6,8,10,12,13,15,17,19,20,22,24,26].map((d) => ({
    id: `mock-achieved-${d}`, user_id: 'mock', habit_id: 'mock',
    target_date: `2026-03-${String(d).padStart(2, '0')}`,
    completed_at: `2026-03-${String(d).padStart(2, '0')}T10:00:00Z`,
    penalty_triggered: false, penalty_executed_at: null, deadline_at: '',
  })),
  ...[7,14,21].map((d) => ({
    id: `mock-penalty-${d}`, user_id: 'mock', habit_id: 'mock',
    target_date: `2026-03-${String(d).padStart(2, '0')}`,
    completed_at: null,
    penalty_triggered: true, penalty_executed_at: `2026-03-${String(d).padStart(2, '0')}T23:30:00Z`,
    deadline_at: '',
  })),
];


type DayStatus = 'achieved' | 'penalty' | 'none' | 'future';
type DayInfo = { date: string; day: number; status: DayStatus };

export default function History() {
  const { user } = useAuth();
  const [year, setYear] = useState(DEBUG_SCREENSHOT_MODE ? 2026 : new Date().getFullYear());
  const [month, setMonth] = useState(DEBUG_SCREENSHOT_MODE ? 2 : new Date().getMonth()); // 2 = 3月
  const [logs, setLogs] = useState<HabitLog[]>(DEBUG_SCREENSHOT_MODE ? MOCK_LOGS : []);
  const [isLoading, setIsLoading] = useState(!DEBUG_SCREENSHOT_MODE);
  const fetchLogs = useCallback(async (silent = false) => {
    if (DEBUG_SCREENSHOT_MODE) return;
    if (!user) return;
    if (!silent) setIsLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('target_date', startDate)
      .lte('target_date', endDate);
    if (!error) setLogs((data ?? []) as HabitLog[]);
    setIsLoading(false);
  }, [user, year, month]);

  // 月・ユーザーが変わったら再取得（ローディング表示あり）
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // タブフォーカス時にサイレント再取得（チカチカなし）
  useFocusEffect(useCallback(() => {
    fetchLogs(true);
  }, [fetchLogs]));

  // Realtimeサブスクリプション（サイレント更新）
  useEffect(() => {
    if (!user) return;
    const subscription = supabase
      .channel(`history_${user.id}_${year}_${month}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${user.id}` },
        () => fetchLogs(true)
      )
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [user, year, month, fetchLogs]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth()) return;
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const buildCalendar = (): (DayInfo | null)[] => {
    const firstDay = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const cells: (DayInfo | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLogs = logs.filter((l) => l.target_date === dateStr);
      const isFuture = new Date(year, month, d) > today;
      let status: DayStatus = 'none';
      if (isFuture) {
        status = 'future';
      } else if (dayLogs.length > 0) {
        // その日の全ログの最新アクション時刻でステータスを決定する
        let latestTime = 0;
        let latestStatus: 'achieved' | 'penalty' | 'none' = 'none';
        for (const log of dayLogs) {
          if (log.penalty_executed_at) {
            const t = new Date(log.penalty_executed_at).getTime();
            if (t > latestTime) { latestTime = t; latestStatus = 'penalty'; }
          }
          if (log.completed_at) {
            const t = new Date(log.completed_at).getTime();
            if (t > latestTime) { latestTime = t; latestStatus = 'achieved'; }
          }
          // penalty_executed_at がまだない場合の fallback
          if (log.penalty_triggered && !log.penalty_executed_at && latestStatus === 'none') {
            latestStatus = 'penalty';
          }
        }
        status = latestStatus;
      }
      cells.push({ date: dateStr, day: d, status });
    }
    return cells;
  };

  const calcAchievementRate = (): number => {
    const past = logs.filter((l) => new Date(l.target_date) <= new Date());
    if (past.length === 0) return 0;
    return Math.round((past.filter((l) => l.completed_at !== null).length / past.length) * 100);
  };

  const calendarDays = useMemo(() => buildCalendar(), [logs, year, month]);
  const achievementRate = useMemo(() => calcAchievementRate(), [logs, year, month]);
  const isCurrentMonth = DEBUG_SCREENSHOT_MODE || (year === new Date().getFullYear() && month === new Date().getMonth());

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <PageHeader title="CALENDAR" />

        {/* 月ナビゲーション */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navButton} onPress={prevMonth}>
            <Ionicons name="chevron-back" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{year}年 {MONTH_NAMES[month]}</Text>
          <TouchableOpacity
            style={[styles.navButton, isCurrentMonth && styles.navButtonDisabled]}
            onPress={nextMonth}
            disabled={isCurrentMonth}
          >
            <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? COLORS.textMuted : COLORS.text} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
        ) : (
          <>
            {/* 曜日ヘッダー */}
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Text key={i} style={[
                  styles.weekdayLabel,
                  i === 0 && styles.sunday,
                  i === 6 && styles.saturday,
                ]}>
                  {label}
                </Text>
              ))}
            </View>

            {/* カレンダーグリッド */}
            <View style={styles.calendar}>
              {calendarDays.map((cell, index) => (
                <View key={index} style={styles.cell}>
                  {cell && (
                    <>
                      <Text style={[
                        styles.dayNumber,
                        cell.status === 'future' && styles.dayFuture,
                      ]}>
                        {cell.day}
                      </Text>
                      {cell.status === 'achieved' && (
                        <View style={[styles.mark, styles.markAchieved]} />
                      )}
                      {cell.status === 'penalty' && (
                        <View style={[styles.mark, styles.markPenalty]} />
                      )}
                    </>
                  )}
                </View>
              ))}
            </View>

            {/* 凡例 */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.markAchieved]} />
                <Text style={styles.legendText}>達成</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.markPenalty]} />
                <Text style={styles.legendText}>ペナルティ</Text>
              </View>
            </View>

            {/* 達成率カード */}
            <View style={styles.rateCard}>
              <View style={styles.rateHeader}>
                <Text style={styles.rateLabel}>今月の達成率</Text>
                <Text style={styles.rateValue}>{achievementRate}<Text style={styles.rateUnit}>%</Text></Text>
              </View>
              <View style={styles.rateBar}>
                <View style={[styles.rateBarFill, { width: `${achievementRate}%` as `${number}%` }]} />
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <BannerAd />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: 60 },
  monthNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  navButton: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  navButtonDisabled: { opacity: 0.3 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  weekdayRow: { flexDirection: 'row', marginBottom: SPACING.xs },
  weekdayLabel: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700',
    color: COLORS.textSecondary, letterSpacing: 1,
  },
  sunday: { color: COLORS.danger },
  saturday: { color: '#4F7BE8' },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs,
  },
  dayNumber: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  dayFuture: { color: COLORS.textMuted },
  mark: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  markAchieved: { backgroundColor: COLORS.success },
  markPenalty: { backgroundColor: COLORS.danger },
  legend: {
    flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.md,
    marginBottom: SPACING.lg, justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  rateCard: {
    backgroundColor: COLORS.surface, borderRadius: 8, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  rateLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 2, textTransform: 'uppercase' },
  rateValue: { fontSize: 40, fontWeight: '900', color: COLORS.text, lineHeight: 44, letterSpacing: -1 },
  rateUnit: { fontSize: 20, fontWeight: '700', color: COLORS.textSecondary },
  rateBar: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  rateBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
});
