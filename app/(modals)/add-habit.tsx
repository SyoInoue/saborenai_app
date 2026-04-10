/**
 * 習慣追加モーダル
 */

import { useState, useRef } from 'react';
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { PageHeader } from '@/components/PageHeader';
import { Ionicons } from '@expo/vector-icons';
import { useHabits } from '@/hooks/useHabits';
import { usePurchase } from '@/providers/PurchaseProvider';
import { setPendingToast, setPendingCreation } from '@/lib/pendingToast';
import { COLORS, SPACING, HABIT_LIMIT_FREE, HABIT_LIMIT_PRO, PENALTY_TWEET_TEXT } from '@/constants/config';
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

function countXChars(text: string): number {
  let count = 0;
  for (const char of text) {
    count += (char.codePointAt(0) ?? 0) > 0x7e ? 2 : 1;
  }
  return count;
}

function defaultDeadlineDate(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5, 0, 0);
  const minutes = Math.ceil(d.getMinutes() / 5) * 5;
  d.setMinutes(minutes, 0, 0);
  return d;
}

export default function AddHabit() {
  const router = useRouter();
  const { habits, addHabit, isLoading: habitsLoading } = useHabits();
  const { isPro, purchasePro, isLoading: isPurchaseLoading } = usePurchase();

  const [name, setName] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(defaultDeadlineDate);
  const [repeatDays, setRepeatDays] = useState<WeekDay[]>([1, 2, 3, 4, 5]);
  const [penaltyText, setPenaltyText] = useState(PENALTY_TWEET_TEXT);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // タスク名 + ペナルティ文の合計で140文字制限（投稿フォーマット: 【名前】\n本文\n\nハッシュタグ\n📅日時）
  const X_COMBINED_LIMIT = 140;
  const combinedCharCount = countXChars(name) + countXChars(penaltyText);
  const isOverXLimit = combinedCharCount > X_COMBINED_LIMIT;
  const habitLimit = isPro ? HABIT_LIMIT_PRO : HABIT_LIMIT_FREE;

  if (habitsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (habits.length >= habitLimit) {
    return (
      <View style={styles.limitContainer}>
        <Ionicons name="lock-closed" size={48} color={COLORS.border} />
        <Text style={styles.limitTitle}>習慣の上限に達しました</Text>
        <Text style={styles.limitDescription}>
          {isPro
            ? `Proプランでは最大${HABIT_LIMIT_PRO}個まで登録できます。`
            : `無料プランでは${HABIT_LIMIT_FREE}個まで登録できます。\nProプランで最大${HABIT_LIMIT_PRO}個登録できます。`}
        </Text>

        {!isPro && (
          <>
            <View style={styles.limitPlanRow}>
              <TouchableOpacity
                style={[styles.limitPlanOption, selectedPlan === 'monthly' && styles.limitPlanSelected]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <Text style={[styles.limitPlanLabel, selectedPlan === 'monthly' && styles.limitPlanLabelSelected]}>月額</Text>
                <Text style={[styles.limitPlanPrice, selectedPlan === 'monthly' && styles.limitPlanPriceSelected]}>¥300/月</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.limitPlanOption, selectedPlan === 'yearly' && styles.limitPlanSelected]}
                onPress={() => setSelectedPlan('yearly')}
              >
                <View style={styles.limitPlanBadgeRow}>
                  <Text style={[styles.limitPlanLabel, selectedPlan === 'yearly' && styles.limitPlanLabelSelected]}>年額</Text>
                  <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>お得</Text></View>
                </View>
                <Text style={[styles.limitPlanPrice, selectedPlan === 'yearly' && styles.limitPlanPriceSelected]}>¥3,000/年</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.upgradeButton, isPurchaseLoading && styles.buttonDisabled]}
              onPress={() => purchasePro(selectedPlan)}
              disabled={isPurchaseLoading}
            >
              {isPurchaseLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.upgradeButtonText}>PRO にアップグレード</Text>
              )}
            </TouchableOpacity>
          </>
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

  const handleTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setDeadlineDate(date);
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
    // 今日が繰り返し対象に含まれる場合のみ時刻チェック
    const todayWeekday = new Date().getDay() as WeekDay;
    if (repeatDays.includes(todayWeekday)) {
      const now = new Date();
      const deadlineToday = new Date();
      deadlineToday.setHours(deadlineDate.getHours(), deadlineDate.getMinutes(), 0, 0);
      const diffMinutes = (deadlineToday.getTime() - now.getTime()) / 60000;
      // 過去の時刻 → 来週の初回扱いなのでOK
      // 0〜5分後 → 近すぎるのでNG
      if (diffMinutes >= 0 && diffMinutes < 5) {
        Alert.alert('入力エラー', '期限時刻は現在時刻の5分以上後に設定してください。');
        return;
      }
    }
    setIsSaving(true);
    try {
      const hour = String(deadlineDate.getHours()).padStart(2, '0');
      const minute = String(deadlineDate.getMinutes()).padStart(2, '0');
      await addHabit({
        name: name.trim(),
        deadline_time: `${hour}:${minute}`,
        repeat_days: repeatDays,
        penalty_text: penaltyText.trim() || null,
      });
      setPendingCreation();
      setPendingToast(`「${name.trim()}」を追加しました`, 'success');
      router.back();
    } catch {
      Alert.alert('エラー', '習慣の追加に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.wrapper}>
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets={true}
    >
      {/* ヘッダー */}
      <PageHeader title="ADD HABIT" />

      {/* 習慣名 */}
      <View style={styles.section}>
        <Text style={styles.label}>習慣名</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例: 筋トレ30分"
          placeholderTextColor={COLORS.textMuted}
          maxLength={50}
          returnKeyType="done"
          keyboardAppearance="dark"
        />
      </View>

      {/* 期限時刻 */}
      <View style={styles.section}>
        <Text style={styles.label}>期限時刻</Text>
        <Text style={styles.labelHint}>この時刻までに完了しないとペナルティが発動します</Text>
        <View style={styles.timePickerContainer}>
          <DateTimePicker
            value={deadlineDate}
            mode="time"
            display="spinner"
            onChange={handleTimeChange}
            minuteInterval={5}
            locale="ja_JP"
            style={styles.timePicker}
            textColor={COLORS.text}
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
              style={[styles.dayButton, repeatDays.includes(value) && styles.dayButtonSelected]}
              onPress={() => toggleDay(value)}
            >
              <Text style={[styles.dayText, repeatDays.includes(value) && styles.dayTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ペナルティ設定 */}
      <View style={styles.section}>
        <Text style={styles.label}>ペナルティ投稿内容</Text>
        <Text style={styles.labelHint}>サボったらこの内容がXに自動投稿されます</Text>
        <TextInput
          style={[styles.input, styles.penaltyTextInput, isOverXLimit && styles.inputError]}
          value={penaltyText}
          onChangeText={(text) => {
            if (countXChars(name) + countXChars(text) <= X_COMBINED_LIMIT) setPenaltyText(text);
          }}
          multiline
          blurOnSubmit={false}
          numberOfLines={3}
          placeholder="ペナルティとして投稿するテキスト"
          placeholderTextColor={COLORS.textMuted}
          keyboardAppearance="dark"
          onFocus={() => {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
          }}
        />
        <Text style={[styles.charCount, isOverXLimit && styles.charCountError]}>
          タスク名＋本文: {combinedCharCount} / {X_COMBINED_LIMIT}
        </Text>
      </View>

      {/* 保存ボタン */}
      <TouchableOpacity
        style={[styles.saveButton, (isSaving || isOverXLimit) && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={isSaving || isOverXLimit}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.saveButtonText}>追加する</Text>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>キャンセル</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: 60, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  section: { marginBottom: SPACING.lg },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  labelHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: { borderColor: COLORS.danger },

  timePickerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    alignItems: 'center',
  },
  timePicker: { width: '100%', height: 150 },

  daysContainer: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  dayButton: {
    width: 44, height: 44, borderRadius: 4,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  dayButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  dayTextSelected: { color: '#FFFFFF' },

  penaltyTextInput: { height: 80, textAlignVertical: 'top', paddingTop: SPACING.sm },
  charCount: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: SPACING.xs, fontWeight: '600' },
  charCountError: { color: COLORS.danger },

  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
    minHeight: 52,
  },
  buttonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  cancelButton: { paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
  cancelButtonText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  limitContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: SPACING.xl, backgroundColor: COLORS.background, gap: SPACING.md,
  },
  limitTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, letterSpacing: 1 },
  limitDescription: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  limitPlanRow: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  limitPlanOption: {
    flex: 1, borderRadius: 10, padding: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center',
  },
  limitPlanSelected: { borderColor: COLORS.primary },
  limitPlanBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  limitPlanLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  limitPlanLabelSelected: { color: COLORS.text },
  limitPlanPrice: { fontSize: 15, fontWeight: '800', color: COLORS.textSecondary, marginTop: 2 },
  limitPlanPriceSelected: { color: COLORS.primary },
  saveBadge: { backgroundColor: COLORS.primary, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  saveBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  upgradeButton: {
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl, minHeight: 52, justifyContent: 'center', alignItems: 'center', width: '100%',
  },
  upgradeButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  closeButton: { paddingVertical: SPACING.sm },
  closeButtonText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
});
