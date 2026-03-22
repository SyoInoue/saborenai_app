/**
 * 履歴画面
 * カレンダービューで達成・ペナルティを可視化し、月間達成率を表示する
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { COLORS, SPACING } from '@/constants/config';
import type { HabitLog } from '@/types';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

type DayStatus = 'achieved' | 'penalty' | 'none' | 'future';

type DayInfo = {
  date: string; // YYYY-MM-DD
  day: number;
  status: DayStatus;
};

export default function History() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()); // 0-indexed
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    if (!user) return;
    setIsLoading(true);

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('target_date', startDate)
      .lte('target_date', endDate);

    if (!error) {
      setLogs((data ?? []) as HabitLog[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [user, year, month]);

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

  // カレンダーデータを構築
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
      } else if (dayLogs.some((l) => l.penalty_triggered)) {
        status = 'penalty';
      } else if (dayLogs.some((l) => l.completed_at !== null)) {
        status = 'achieved';
      }

      cells.push({ date: dateStr, day: d, status });
    }

    return cells;
  };

  // 月間達成率を計算
  const calcAchievementRate = (): number => {
    const past = logs.filter((l) => new Date(l.target_date) <= new Date());
    if (past.length === 0) return 0;
    const achieved = past.filter((l) => l.completed_at !== null).length;
    return Math.round((achieved / past.length) * 100);
  };

  const calendar = buildCalendar();
  const achievementRate = calcAchievementRate();
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>習慣の履歴</Text>

      {/* 月ナビゲーション */}
      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navButton} onPress={prevMonth}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{year}年 {MONTH_NAMES[month]}</Text>
        <TouchableOpacity
          style={[styles.navButton, isCurrentMonth && styles.navButtonDisabled]}
          onPress={nextMonth}
          disabled={isCurrentMonth}
        >
          <Text style={[styles.navButtonText, isCurrentMonth && styles.navButtonTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <>
          {/* 曜日ヘッダー */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Text key={i} style={[styles.weekdayLabel, i === 0 && styles.sunday, i === 6 && styles.saturday]}>
                {label}
              </Text>
            ))}
          </View>

          {/* カレンダーグリッド */}
          <View style={styles.calendar}>
            {calendar.map((cell, index) => (
              <View key={index} style={styles.cell}>
                {cell && (
                  <>
                    <Text style={[
                      styles.dayNumber,
                      cell.status === 'future' && styles.dayFuture,
                    ]}>
                      {cell.day}
                    </Text>
                    {cell.status === 'achieved' && <View style={[styles.mark, styles.markAchieved]} />}
                    {cell.status === 'penalty' && <View style={[styles.mark, styles.markPenalty]} />}
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

          {/* 月間達成率 */}
          <View style={styles.rateCard}>
            <Text style={styles.rateLabel}>今月の達成率</Text>
            <Text style={styles.rateValue}>{achievementRate}%</Text>
            <View style={styles.rateBar}>
              <View style={[styles.rateBarFill, { width: `${achievementRate}%` as `${number}%` }]} />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 22,
    color: COLORS.text,
  },
  navButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sunday: {
    color: COLORS.danger,
  },
  saturday: {
    color: '#4F46E5',
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  dayNumber: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  dayFuture: {
    color: COLORS.textSecondary,
    opacity: 0.5,
  },
  mark: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  markAchieved: {
    backgroundColor: COLORS.success,
  },
  markPenalty: {
    backgroundColor: COLORS.danger,
  },
  legend: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  rateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rateLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  rateValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  rateBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  rateBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
});
