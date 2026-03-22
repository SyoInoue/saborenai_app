/**
 * 習慣追加モーダル
 * タスク名・期限時刻・曜日を入力して習慣を追加する
 * 無料ユーザーは1個まで制限
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useHabits } from '@/hooks/useHabits';
import { usePurchase } from '@/providers/PurchaseProvider';
import { COLORS, SPACING, HABIT_LIMIT_FREE, HABIT_LIMIT_PRO } from '@/constants/config';
import type { WeekDay } from '@/types';

const WEEKDAYS: { label: string; value: WeekDay }[] = [
  { label: '日', value: 0 },
  { label: '月', value: 1 },
  { label: '火', value: 2 },
  { label: '水', value: 3 },
  { label: '木', value: 4 },
  { label: '金', value: 5 },
  { label: '土', value: 6 },
];

export default function AddHabit() {
  const router = useRouter();
  const { habits, addHabit } = useHabits();
  const { isPro } = usePurchase();

  const [name, setName] = useState('');
  const [deadlineHour, setDeadlineHour] = useState('21');
  const [deadlineMinute, setDeadlineMinute] = useState('00');
  const [repeatDays, setRepeatDays] = useState<WeekDay[]>([1, 2, 3, 4, 5]); // 平日デフォルト
  const [isSaving, setIsSaving] = useState(false);

  const habitLimit = isPro ? HABIT_LIMIT_PRO : HABIT_LIMIT_FREE;

  // スロット上限チェック
  if (habits.length >= habitLimit) {
    return (
      <View style={styles.limitContainer}>
        <Text style={styles.limitEmoji}>🔒</Text>
        <Text style={styles.limitTitle}>習慣の上限に達しました</Text>
        <Text style={styles.limitDescription}>
          {isPro
            ? `Proプランでは最大${HABIT_LIMIT_PRO}個まで登録できます。`
            : `無料プランでは${HABIT_LIMIT_FREE}個まで登録できます。\nProプランにアップグレードすると最大${HABIT_LIMIT_PRO}個登録できます。`}
        </Text>
        {!isPro && (
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>Proにアップグレード（¥300/月）</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>閉じる</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleDay = (day: WeekDay) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('入力エラー', '習慣名を入力してください。');
      return;
    }

    if (repeatDays.length === 0) {
      Alert.alert('入力エラー', '繰り返す曜日を1日以上選択してください。');
      return;
    }

    const hour = parseInt(deadlineHour, 10);
    const minute = parseInt(deadlineMinute, 10);

    if (isNaN(hour) || hour < 0 || hour > 23) {
      Alert.alert('入力エラー', '時間は0〜23で入力してください。');
      return;
    }
    if (isNaN(minute) || minute < 0 || minute > 59) {
      Alert.alert('入力エラー', '分は00〜59で入力してください。');
      return;
    }

    setIsSaving(true);
    try {
      await addHabit({
        name: name.trim(),
        deadline_time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        repeat_days: repeatDays,
      });
      router.back();
    } catch (error) {
      console.error('習慣追加エラー:', error);
      Alert.alert('エラー', '習慣の追加に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>習慣を追加</Text>

      {/* 習慣名 */}
      <View style={styles.section}>
        <Text style={styles.label}>習慣名</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例: 筋トレ30分"
          placeholderTextColor={COLORS.textSecondary}
          maxLength={50}
          returnKeyType="done"
        />
      </View>

      {/* 期限時刻 */}
      <View style={styles.section}>
        <Text style={styles.label}>期限時刻</Text>
        <Text style={styles.labelHint}>この時刻までに完了しないとペナルティが発動します</Text>
        <View style={styles.timeInput}>
          <TextInput
            style={[styles.input, styles.timeField]}
            value={deadlineHour}
            onChangeText={setDeadlineHour}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="21"
            placeholderTextColor={COLORS.textSecondary}
          />
          <Text style={styles.timeSeparator}>:</Text>
          <TextInput
            style={[styles.input, styles.timeField]}
            value={deadlineMinute}
            onChangeText={setDeadlineMinute}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="00"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>
      </View>

      {/* 繰り返し曜日 */}
      <View style={styles.section}>
        <Text style={styles.label}>繰り返す曜日</Text>
        <View style={styles.daysContainer}>
          {WEEKDAYS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.dayButton,
                repeatDays.includes(value) && styles.dayButtonSelected,
              ]}
              onPress={() => toggleDay(value)}
            >
              <Text
                style={[
                  styles.dayText,
                  repeatDays.includes(value) && styles.dayTextSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 保存ボタン */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>追加する</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>キャンセル</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.xl,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  labelHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeField: {
    width: 80,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  daysContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  limitContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  limitEmoji: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  limitTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  limitDescription: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  upgradeButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingVertical: SPACING.sm,
  },
  closeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});
