/**
 * 設定画面
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/providers/AuthProvider';
import { usePurchase } from '@/providers/PurchaseProvider';
import { useHabits } from '@/hooks/useHabits';
import { supabase } from '@/lib/supabase';
import { BannerAd } from '@/components/BannerAd';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { COLORS, SPACING } from '@/constants/config';
import { useDeletedHabits } from '@/providers/DeletedHabitsProvider';
import { consumePendingCreation, isPendingCreation } from '@/lib/pendingToast';
import type { ProPlan } from '@/types';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function formatRepeatDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(' · ');
}

export default function Settings() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isPro, purchasePro, restorePurchases, isLoading: isPurchaseLoading } = usePurchase();
  const { habits, deleteHabit, refetch, isLoading: isHabitsLoading } = useHabits();
  const { markDeleted } = useDeletedHabits();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ProPlan>('monthly');
  const { toast, showToast, hideToast } = useToast();

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        await refetch();
        consumePendingCreation();
      };
      run();
    }, [refetch])
  );

  const handleSignOut = () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          await signOut();
          router.replace('/(auth)/onboarding');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'アカウント削除',
      'アカウントを削除すると、全てのデータが失われます。本当に削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              // 明示的に全データを削除（RLS + CASCADEの両方で確実に消す）
              await supabase.from('habit_logs').delete().eq('user_id', user.id);
              await supabase.from('habits').delete().eq('user_id', user.id);
              await supabase.from('users').delete().eq('id', user.id);
              await signOut();
              router.replace('/(auth)/onboarding');
            } catch {
              Alert.alert('エラー', 'アカウントの削除に失敗しました。');
            }
          },
        },
      ]
    );
  };

  const handleDeleteHabit = (habitId: string, habitName: string) => {
    Alert.alert(`「${habitName}」を削除しますか？`, '', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            markDeleted(habitId);
            await deleteHabit(habitId);
            showToast(`「${habitName}」を削除しました`, 'error');
          } catch {
            Alert.alert('エラー', '習慣の削除に失敗しました。');
          }
        },
      },
    ]);
  };

  if (!user) return null;

  return (
    <View style={styles.wrapper}>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <PageHeader title="SETTINGS" />

        {/* Xアカウント */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>X ACCOUNT</Text>
          <View style={styles.accountCard}>
            {user.x_avatar_url ? (
              <Image source={{ uri: user.x_avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={22} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.accountInfo}>
              <Text style={styles.displayName}>{user.x_display_name ?? user.x_username}</Text>
              <Text style={styles.username}>@{user.x_username}</Text>
            </View>
            {isPro && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
        </View>

        {/* 習慣管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HABITS</Text>
          {(isHabitsLoading || isPendingCreation()) ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator color={COLORS.primary} size="small" />
            </View>
          ) : habits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>習慣がまだありません</Text>
            </View>
          ) : (
            habits.map((habit) => (
              <View key={habit.id} style={styles.habitRow}>
                <View style={styles.accentLine} />
                <View style={styles.habitInfo}>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  <View style={styles.habitMeta}>
                    <Ionicons name="time-outline" size={11} color={COLORS.textSecondary} />
                    <Text style={styles.habitMetaText}>{habit.deadline_time.slice(0, 5)}</Text>
                    <Text style={styles.habitMetaDot}>·</Text>
                    <Ionicons name="calendar-outline" size={11} color={COLORS.textSecondary} />
                    <Text style={styles.habitMetaText}>{formatRepeatDays(habit.repeat_days)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteHabit(habit.id, habit.name)}
                >
                  <Text style={styles.deleteButtonText}>削除</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Proプラン */}
        {!isPro ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PREMIUM</Text>
            <View style={styles.proCard}>
              <Text style={styles.proCardTitle}>PRO にアップグレード</Text>
              <View style={styles.featureList}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                  <Text style={styles.featureText}>習慣を最大10個登録</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                  <Text style={styles.featureText}>広告非表示</Text>
                </View>
              </View>

              <View style={styles.planSelector}>
                <TouchableOpacity
                  style={[styles.planOption, selectedPlan === 'monthly' && styles.planSelected]}
                  onPress={() => setSelectedPlan('monthly')}
                >
                  <Text style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelSelected]}>月額</Text>
                  <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>¥300</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.planOption, selectedPlan === 'yearly' && styles.planSelected]}
                  onPress={() => setSelectedPlan('yearly')}
                >
                  <View style={styles.planBadgeRow}>
                    <Text style={[styles.planLabel, selectedPlan === 'yearly' && styles.planLabelSelected]}>年額</Text>
                    <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>お得</Text></View>
                  </View>
                  <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.planPriceSelected]}>¥3,000</Text>
                  <Text style={styles.planSub}>¥250/月相当</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.proButton, isPurchaseLoading && styles.buttonDisabled]}
                onPress={() => purchasePro(selectedPlan)}
                disabled={isPurchaseLoading}
              >
                {isPurchaseLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.proButtonText}>
                    {selectedPlan === 'yearly' ? '年額プランで始める' : '月額プランで始める'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.restoreButton} onPress={restorePurchases}>
                <Text style={styles.restoreText}>購入を復元する</Text>
              </TouchableOpacity>

              <Text style={styles.legalNotice}>
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('https://syoinoue.github.io/yaraneva-legal/terms-of-service.html')}
                >利用規約</Text>
                {'  ・  '}
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('https://syoinoue.github.io/yaraneva-legal/privacy-policy.html')}
                >プライバシーポリシー</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PREMIUM</Text>
            <View style={styles.proActiveCard}>
              <Ionicons name="star" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.proActiveTitle}>PRO プラン利用中</Text>
                <Text style={styles.proActiveDesc}>習慣10個・広告非表示が有効です</Text>
              </View>
            </View>
          </View>
        )}

        {/* アカウント操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>

          <TouchableOpacity
            style={styles.dangerRow}
            onPress={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <ActivityIndicator color={COLORS.danger} size="small" />
            ) : (
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
            )}
            <Text style={styles.dangerText}>ログアウト</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            <Text style={styles.dangerText}>アカウントを削除する</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <BannerAd />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: 60, paddingBottom: 40 },


  section: { marginBottom: SPACING.xl },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.border },
  avatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  accountInfo: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  username: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  proBadge: {
    backgroundColor: COLORS.primary, borderRadius: 3,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  proBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: 8, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: COLORS.textSecondary },

  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  accentLine: { width: 3, alignSelf: 'stretch', backgroundColor: COLORS.primary },
  habitInfo: { flex: 1, padding: SPACING.md },
  habitName: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  habitMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  habitMetaText: { fontSize: 11, color: COLORS.textSecondary },
  habitMetaDot: { fontSize: 11, color: COLORS.textMuted },
  deleteButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },

  proCard: {
    backgroundColor: COLORS.surface, borderRadius: 8, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  proCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm, letterSpacing: 0.5 },
  featureList: { gap: 6, marginBottom: SPACING.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  featureText: { fontSize: 13, color: COLORS.textSecondary },

  planSelector: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  planOption: {
    flex: 1, borderRadius: 10, padding: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated, alignItems: 'center',
  },
  planSelected: { borderColor: COLORS.primary },
  planBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  planLabelSelected: { color: COLORS.text },
  planPrice: { fontSize: 18, fontWeight: '900', color: COLORS.textSecondary, marginTop: 2 },
  planPriceSelected: { color: COLORS.primary },
  planSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: '600' },
  saveBadge: { backgroundColor: COLORS.primary, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  saveBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },

  proButton: {
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: SPACING.md,
    alignItems: 'center', marginBottom: SPACING.sm, minHeight: 44, justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  proButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  restoreButton: { alignItems: 'center', paddingVertical: SPACING.xs },
  restoreText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  legalNotice: { textAlign: 'center', marginTop: SPACING.sm, fontSize: 11, color: COLORS.textMuted },
  legalLink: { color: COLORS.textSecondary, textDecorationLine: 'underline' },

  proActiveCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: 8, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  proActiveTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  proActiveDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  dangerRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: '#2A1010', borderRadius: 8,
    backgroundColor: '#160808',
  },
  dangerText: { fontSize: 14, color: COLORS.danger, fontWeight: '600' },
});
