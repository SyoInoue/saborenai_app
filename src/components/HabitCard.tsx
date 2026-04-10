/**
 * 習慣カードコンポーネント
 */

import { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/constants/config';
import type { HabitCardStatus, HabitWithLog } from '@/types';

type Props = {
  item: HabitWithLog;
  onComplete: (logId: string) => Promise<void>;
};

function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':');
}

export const HabitCard = memo(function HabitCard({ item, onComplete }: Props) {
  const { habit, log } = item;
  const [now, setNow] = useState(Date.now());
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const deadlineTs = log?.deadline_at ? new Date(log.deadline_at).getTime() : null;

  const status: HabitCardStatus = (() => {
    if (!log) return 'pending';
    if (log.completed_at) return 'completed';
    if (log.penalty_executed_at) return 'penalized';
    if (deadlineTs && now > deadlineTs) return 'overdue';
    return 'pending';
  })();

  const remainingMs = deadlineTs ? deadlineTs - now : 0;
  const isUrgent = remainingMs > 0 && remainingMs < 30 * 60 * 1000;

  const handleComplete = () => {
    if (!log) return;
    Alert.alert(
      '完了確認',
      '本当に完了しましたか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'はい',
          onPress: async () => {
            setIsCompleting(true);
            try {
              await onComplete(log.id);
            } catch {
              Alert.alert('エラー', '完了の記録に失敗しました。');
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  };

  const isOverdue = status === 'overdue' || status === 'penalized';
  const isCompleted = status === 'completed';

  return (
    <View style={[
      styles.card,
      isOverdue && styles.cardOverdue,
      isCompleted && styles.cardCompleted,
      status === 'penalized' && styles.cardPenalized,
    ]}>
      {/* 左アクセントライン */}
      <View style={[
        styles.accentLine,
        isCompleted && styles.accentLineSuccess,
        isOverdue && styles.accentLineDanger,
      ]} />

      <View style={styles.inner}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={[
            styles.habitName,
            isCompleted && styles.habitNameCompleted,
          ]} numberOfLines={1}>
            {habit.name}
          </Text>
          {isCompleted && (
            <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
          )}
          {status === 'penalized' && (
            <Ionicons name="flash" size={22} color={COLORS.primary} />
          )}
        </View>

        {/* 期限 */}
        <View style={styles.metaRow}>
          <Ionicons
            name="time-outline"
            size={13}
            color={isOverdue ? COLORS.danger : COLORS.textSecondary}
          />
          <Text style={[styles.deadline, isOverdue && styles.deadlineOverdue]}>
            {habit.deadline_time.slice(0, 5)}
          </Text>
        </View>

        {/* カウントダウン */}
        {status === 'pending' && deadlineTs && (
          <View style={[styles.countdown, isUrgent && styles.countdownUrgent]}>
            <Ionicons
              name="timer-outline"
              size={14}
              color={isUrgent ? COLORS.warning : '#AAAAAA'}
            />
            <Text style={[styles.countdownText, isUrgent && styles.countdownTextUrgent]}>
              {formatRemainingTime(remainingMs)}
            </Text>
          </View>
        )}

        {/* 達成バッジ */}
        {isCompleted && (
          <View style={styles.badge}>
            <Text style={styles.badgeTextSuccess}>達成</Text>
          </View>
        )}

        {/* ペナルティ執行済み */}
        {status === 'penalized' && (
          <View style={[styles.badge, styles.badgeDanger]}>
            <Ionicons name="flash" size={11} color={COLORS.primary} />
            <Text style={styles.badgeTextDanger}>ペナルティ執行済み</Text>
          </View>
        )}

        {/* 期限切れ */}
        {status === 'overdue' && (
          <View style={[styles.badge, styles.badgeOverdue]}>
            <Ionicons name="warning-outline" size={11} color={COLORS.warning} />
            <Text style={styles.badgeTextOverdue}>期限切れ</Text>
          </View>
        )}

        {/* 完了ボタン */}
        {status === 'pending' && (
          <TouchableOpacity
            style={[styles.completeButton, isCompleting && styles.buttonDisabled]}
            onPress={handleComplete}
            disabled={isCompleting}
          >
            <Text style={styles.completeButtonText}>
              {isCompleting ? '記録中...' : '完了にする'}
            </Text>
            {!isCompleting && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardOverdue: {
    borderColor: '#3A1A1A',
    backgroundColor: '#160808',
  },
  cardCompleted: {
    borderColor: '#0A2A0A',
    backgroundColor: '#0A160A',
    opacity: 0.8,
  },
  cardPenalized: {
    borderColor: '#3A0A0A',
    backgroundColor: '#1A0505',
  },
  accentLine: {
    width: 3,
    backgroundColor: COLORS.primary,
  },
  accentLineSuccess: {
    backgroundColor: COLORS.success,
  },
  accentLineDanger: {
    backgroundColor: COLORS.danger,
  },
  inner: {
    flex: 1,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  habitName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    letterSpacing: 0.2,
  },
  habitNameCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  deadline: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  deadlineOverdue: {
    color: COLORS.danger,
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#222222',
    borderRadius: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countdownUrgent: {
    backgroundColor: '#1A0F00',
    borderColor: COLORS.warning,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#CCCCCC',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  countdownTextUrgent: {
    color: COLORS.warning,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0A2A0A',
    borderRadius: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  badgeTextSuccess: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.success,
    letterSpacing: 1,
  },
  badgeDanger: {
    backgroundColor: '#1A0505',
    borderColor: COLORS.primary,
  },
  badgeTextDanger: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  badgeOverdue: {
    backgroundColor: '#1A0F00',
    borderColor: COLORS.warning,
  },
  badgeTextOverdue: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.warning,
    letterSpacing: 1,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingVertical: 10,
    marginTop: SPACING.xs,
    minHeight: 40,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
