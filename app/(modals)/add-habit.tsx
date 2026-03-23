/**
 * 習慣追加モーダル
 * 習慣名・期限時刻（トグル式）・曜日・ペナルティ設定を入力して習慣を追加する
 * 無料ユーザーは1個まで制限
 */

import { useState, useCallback } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { useHabits } from '@/hooks/useHabits';
import { usePurchase } from '@/providers/PurchaseProvider';
import { tempStore } from '@/lib/tempStore';
import { WheelPicker } from '@/components/WheelPicker';
import { COLORS, SPACING, HABIT_LIMIT_FREE, HABIT_LIMIT_PRO, PENALTY_TWEET_TEXT } from '@/constants/config';
import type { WeekDay, PenaltyType } from '@/types';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

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
  const { habits, addHabit, isLoading: habitsLoading } = useHabits();
  const { isPro, purchasePro, isLoading: isPurchaseLoading } = usePurchase();

  const [name, setName] = useState('');
  const [deadlineHour, setDeadlineHour] = useState(21);
  const [deadlineMinuteIndex, setDeadlineMinuteIndex] = useState(0);
  const [repeatDays, setRepeatDays] = useState<WeekDay[]>([1, 2, 3, 4, 5]);
  const [penaltyType, setPenaltyType] = useState<PenaltyType>('text');
  const [penaltyText, setPenaltyText] = useState(PENALTY_TWEET_TEXT);
  const [selfieStoragePath, setSelfieStoragePath] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isSaving, setIsSaving] = useState(false);

  const habitLimit = isPro ? HABIT_LIMIT_PRO : HABIT_LIMIT_FREE;

  // selfie-capture から戻ってきた時に tempStore から自撮りパスを取得
  useFocusEffect(
    useCallback(() => {
      const pending = tempStore.getSefliePath();
      if (pending) {
        setSelfieStoragePath(pending);
        tempStore.setSefliePath(null);
      }
    }, [])
  );

  // ロード中はスピナー（フラッシュ防止）
  if (habitsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  // 上限チェック（ロード完了後のみ判定）
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
          <>
            {/* プラン選択 */}
            <View style={styles.limitPlanRow}>
              <TouchableOpacity
                style={[styles.limitPlanOption, selectedPlan === 'monthly' && styles.limitPlanSelected]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <Text style={[styles.limitPlanLabel, selectedPlan === 'monthly' && styles.limitPlanLabelSelected]}>
                  月額
                </Text>
                <Text style={[styles.limitPlanPrice, selectedPlan === 'monthly' && styles.limitPlanPriceSelected]}>
                  ¥300/月
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.limitPlanOption, selectedPlan === 'yearly' && styles.limitPlanSelected]}
                onPress={() => setSelectedPlan('yearly')}
              >
                <View style={styles.limitPlanBadgeRow}>
                  <Text style={[styles.limitPlanLabel, selectedPlan === 'yearly' && styles.limitPlanLabelSelected]}>
                    年額
                  </Text>
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>お得</Text>
                  </View>
                </View>
                <Text style={[styles.limitPlanPrice, selectedPlan === 'yearly' && styles.limitPlanPriceSelected]}>
                  ¥3,000/年
                </Text>
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
                <Text style={styles.upgradeButtonText}>
                  ✨ Proにアップグレード
                </Text>
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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('入力エラー', '習慣名を入力してください。');
      return;
    }
    if (repeatDays.length === 0) {
      Alert.alert('入力エラー', '繰り返す曜日を1日以上選択してください。');
      return;
    }
    if (penaltyType === 'selfie' && !selfieStoragePath) {
      Alert.alert('入力エラー', '自撮り写真を撮影してください。');
      return;
    }

    setIsSaving(true);
    try {
      const deadlineMinute = deadlineMinuteIndex * 5;
      await addHabit({
        name: name.trim(),
        deadline_time: `${String(deadlineHour).padStart(2, '0')}:${String(deadlineMinute).padStart(2, '0')}`,
        repeat_days: repeatDays,
        penalty_type: penaltyType,
        penalty_text: penaltyText.trim() || null,
        selfie_storage_path: selfieStoragePath,
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={true}
    >
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

      {/* 期限時刻（スクロールホイール） */}
      <View style={styles.section}>
        <Text style={styles.label}>期限時刻</Text>
        <Text style={styles.labelHint}>この時刻までに完了しないとペナルティが発動します</Text>
        <View style={styles.timePickerContainer}>
          <View style={styles.timePickerColumn}>
            <Text style={styles.timePickerLabel}>時</Text>
            <WheelPicker
              values={HOURS}
              selectedIndex={deadlineHour}
              onSelect={setDeadlineHour}
              width={90}
            />
          </View>
          <Text style={styles.timeSeparator}>:</Text>
          <View style={styles.timePickerColumn}>
            <Text style={styles.timePickerLabel}>分</Text>
            <WheelPicker
              values={MINUTES}
              selectedIndex={deadlineMinuteIndex}
              onSelect={setDeadlineMinuteIndex}
              width={90}
            />
          </View>
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
        <Text style={styles.label}>ペナルティ設定</Text>
        <Text style={styles.labelHint}>期限切れ時にXへ投稿される内容</Text>

        {/* タイプ選択 */}
        <View style={styles.penaltyTypeRow}>
          <TouchableOpacity
            style={[styles.penaltyTypeBtn, penaltyType === 'text' && styles.penaltyTypeBtnSelected]}
            onPress={() => setPenaltyType('text')}
          >
            <Text style={[styles.penaltyTypeBtnText, penaltyType === 'text' && styles.penaltyTypeBtnTextSelected]}>
              📝 テキスト
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.penaltyTypeBtn, penaltyType === 'selfie' && styles.penaltyTypeBtnSelected]}
            onPress={() => setPenaltyType('selfie')}
          >
            <Text style={[styles.penaltyTypeBtnText, penaltyType === 'selfie' && styles.penaltyTypeBtnTextSelected]}>
              📸 自撮り
            </Text>
          </TouchableOpacity>
        </View>

        {/* テキストモード: 投稿内容を編集 */}
        {penaltyType === 'text' && (
          <TextInput
            style={[styles.input, styles.penaltyTextInput]}
            value={penaltyText}
            onChangeText={setPenaltyText}
            multiline
            numberOfLines={3}
            placeholder="ペナルティとして投稿するテキスト"
            placeholderTextColor={COLORS.textSecondary}
            maxLength={200}
          />
        )}

        {/* 自撮りモード */}
        {penaltyType === 'selfie' && (
          <TouchableOpacity
            style={[styles.selfieButton, selfieStoragePath && styles.selfieButtonDone]}
            onPress={() => router.push('/(modals)/selfie-capture?mode=habit')}
          >
            <Text style={[styles.selfieButtonText, selfieStoragePath && styles.selfieButtonTextDone]}>
              {selfieStoragePath ? '✓ 撮影済み（タップして変更）' : '📸 自撮りを撮影する'}
            </Text>
          </TouchableOpacity>
        )}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: 60, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.xl },
  section: { marginBottom: SPACING.lg },
  label: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  labelHint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 10,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
    fontSize: 16, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },

  // 時間ピッカー
  timePickerContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  timePickerColumn: { alignItems: 'center', gap: SPACING.xs },
  timePickerLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  timeSeparator: { fontSize: 36, fontWeight: 'bold', color: COLORS.text, marginTop: 20, marginHorizontal: 4 },

  // 曜日選択
  daysContainer: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  dayButton: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  dayButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  dayTextSelected: { color: '#FFFFFF' },

  // ペナルティ設定
  penaltyTypeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  penaltyTypeBtn: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: 10,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  penaltyTypeBtnSelected: { borderColor: COLORS.primary, backgroundColor: '#FFF5F5' },
  penaltyTypeBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  penaltyTypeBtnTextSelected: { color: COLORS.primary },
  penaltyTextInput: {
    height: 80, textAlignVertical: 'top', paddingTop: SPACING.sm,
  },
  selfieButton: {
    backgroundColor: COLORS.surface, borderRadius: 10, paddingVertical: SPACING.md,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  selfieButtonDone: { borderColor: COLORS.success, backgroundColor: '#F0FDF4', borderStyle: 'solid' },
  selfieButtonText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  selfieButtonTextDone: { color: COLORS.success },

  // 保存・キャンセル
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: SPACING.md,
    alignItems: 'center', marginTop: SPACING.md, minHeight: 52, justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  cancelButton: { paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
  cancelButtonText: { color: COLORS.textSecondary, fontSize: 16 },

  // 上限画面
  limitContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: SPACING.xl, backgroundColor: COLORS.background,
  },
  limitEmoji: { fontSize: 64, marginBottom: SPACING.lg },
  limitTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  limitDescription: {
    fontSize: 15, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.lg,
  },
  limitPlanRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, width: '100%' },
  limitPlanOption: {
    flex: 1, borderRadius: 12, padding: SPACING.sm,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.background, alignItems: 'center',
  },
  limitPlanSelected: { borderColor: COLORS.secondary, backgroundColor: '#E6FAF8' },
  limitPlanBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  limitPlanLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  limitPlanLabelSelected: { color: COLORS.text },
  limitPlanPrice: { fontSize: 15, fontWeight: 'bold', color: COLORS.textSecondary, marginTop: 2 },
  limitPlanPriceSelected: { color: COLORS.secondary },
  saveBadge: {
    backgroundColor: COLORS.primary, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  saveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  upgradeButton: {
    backgroundColor: COLORS.secondary, borderRadius: 12, paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm, minHeight: 52,
    justifyContent: 'center', alignItems: 'center', width: '100%',
  },
  upgradeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  closeButton: { paddingVertical: SPACING.sm },
  closeButtonText: { color: COLORS.textSecondary, fontSize: 16 },
});
