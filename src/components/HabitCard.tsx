/**
 * 習慣カードコンポーネント
 * カウントダウン・完了ボタン・各種状態の表示を担当する
 * status は毎秒リアルタイムに再計算するため、期限切れと同時にボタンが消える
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS, SPACING } from '@/constants/config';
import type { HabitCardStatus, HabitWithLog } from '@/types';

type Props = {
  item: HabitWithLog;
  onComplete: (logId: string) => Promise<void>;
};

/**
 * 残り時間を "HH:MM:SS" 形式の文字列に変換する
 */
function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':');
}

export function HabitCard({ item, onComplete }: Props) {
  const { habit, log } = item;
  const [now, setNow] = useState(Date.now());
  const [isCompleting, setIsCompleting] = useState(false);

  // 毎秒 now を更新してステータス・カウントダウンをリアルタイム再計算
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 期限の Unix タイムスタンプ
  const deadlineTs = log?.deadline_at ? new Date(log.deadline_at).getTime() : null;

  // ステータスをリアルタイム計算（毎秒更新）
  const status: HabitCardStatus = (() => {
    if (!log) return 'pending';
    if (log.completed_at) return 'completed';
    if (log.penalty_triggered) return 'penalized';
    if (deadlineTs && now > deadlineTs) return 'overdue';
    return 'pending';
  })();

  const remainingMs = deadlineTs ? deadlineTs - now : 0;

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
            } catch (error) {
              console.error('完了エラー:', error);
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
    ]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={[styles.habitName, isCompleted && styles.habitNameCompleted]}>
          {habit.name}
        </Text>
        {isCompleted && <Text style={styles.checkmark}>✓</Text>}
        {status === 'penalized' && <Text style={styles.penaltyIcon}>⚡</Text>}
      </View>

      {/* 期限時刻 & ペナルティタイプ */}
      <View style={styles.metaRow}>
        <Text style={[styles.deadline, isOverdue && styles.deadlineOverdue]}>
          期限: {habit.deadline_time.slice(0, 5)}
        </Text>
        <View style={styles.penaltyChip}>
          <Text style={styles.penaltyChipText}>
            {habit.penalty_type === 'selfie' ? '📸 自撮り' : '📝 テキスト'}
          </Text>
        </View>
      </View>

      {/* カウントダウン（pending かつ期限あり） */}
      {status === 'pending' && deadlineTs && (
        <View style={[
          styles.countdown,
          remainingMs < 30 * 60 * 1000 && styles.countdownUrgent,
        ]}>
          <Text style={[
            styles.countdownText,
            remainingMs < 30 * 60 * 1000 && styles.countdownTextUrgent,
          ]}>
            ⏱ {formatRemainingTime(remainingMs)}
          </Text>
        </View>
      )}

      {/* 達成バッジ */}
      {isCompleted && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedBadgeText}>達成！</Text>
        </View>
      )}

      {/* ペナルティ執行済み */}
      {status === 'penalized' && (
        <View style={styles.penaltyBadge}>
          <Text style={styles.penaltyBadgeText}>ペナルティ執行済み</Text>
        </View>
      )}

      {/* 期限切れ（ペナルティ未発動） */}
      {status === 'overdue' && (
        <View style={styles.overdueBadge}>
          <Text style={styles.overdueBadgeText}>期限切れ</Text>
        </View>
      )}

      {/* 完了ボタン（pending のみ表示 — 期限切れになると自動で消える） */}
      {status === 'pending' && (
        <TouchableOpacity
          style={[styles.completeButton, isCompleting && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={isCompleting}
        >
          <Text style={styles.completeButtonText}>
            {isCompleting ? '記録中...' : '完了'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardOverdue: {
    borderColor: COLORS.danger,
    backgroundColor: '#FFF5F5',
  },
  cardCompleted: {
    borderColor: COLORS.success,
    backgroundColor: '#F5FFF5',
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  habitName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  habitNameCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  checkmark: { fontSize: 22, color: COLORS.success },
  penaltyIcon: { fontSize: 22 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  deadline: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  deadlineOverdue: { color: COLORS.danger },
  penaltyChip: {
    backgroundColor: '#F0F4FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  penaltyChipText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  countdown: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  countdownUrgent: { backgroundColor: '#FFF3CD' },
  countdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    fontVariant: ['tabular-nums'],
  },
  countdownTextUrgent: { color: '#D97706' },
  completedBadge: {
    backgroundColor: '#D4EDDA',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
  },
  completedBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  penaltyBadge: {
    backgroundColor: '#F8D7DA',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
  },
  penaltyBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
  overdueBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
  },
  overdueBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
