/**
 * 設定画面
 * アカウント情報・ペナルティ設定変更・習慣管理・Pro課金・ログアウト
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { usePurchase } from '@/providers/PurchaseProvider';
import { useHabits } from '@/hooks/useHabits';
import { supabase } from '@/lib/supabase';
import { COLORS, SPACING } from '@/constants/config';

export default function Settings() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isPro, purchasePro, restorePurchases, isLoading: isPurchaseLoading } = usePurchase();
  const { habits, deleteHabit } = useHabits();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
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
      ]
    );
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
              // usersテーブルの削除（CASCADEで関連データも削除）
              await supabase.from('users').delete().eq('id', user.id);
              await signOut();
              router.replace('/(auth)/onboarding');
            } catch (error) {
              console.error('アカウント削除エラー:', error);
              Alert.alert('エラー', 'アカウントの削除に失敗しました。');
            }
          },
        },
      ]
    );
  };

  const handleDeleteHabit = (habitId: string, habitName: string) => {
    Alert.alert(
      '習慣の削除',
      `「${habitName}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHabit(habitId);
            } catch (error) {
              console.error('習慣削除エラー:', error);
              Alert.alert('エラー', '習慣の削除に失敗しました。');
            }
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>設定</Text>

      {/* Xアカウント情報 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Xアカウント</Text>
        <View style={styles.accountCard}>
          {user.x_avatar_url && (
            <Image source={{ uri: user.x_avatar_url }} style={styles.avatar} />
          )}
          <View>
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

      {/* ペナルティ設定変更 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ペナルティ設定</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(modals)/penalty-setup')}
        >
          <Text style={styles.menuItemText}>
            {user.penalty_type === 'selfie' ? '📸 自撮りモード' : '📝 テキストモード'}
          </Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 習慣管理 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>習慣の管理</Text>
        {habits.length === 0 ? (
          <Text style={styles.emptyText}>習慣がまだありません</Text>
        ) : (
          habits.map((habit) => (
            <View key={habit.id} style={styles.habitRow}>
              <View style={styles.habitInfo}>
                <Text style={styles.habitName}>{habit.name}</Text>
                <Text style={styles.habitDeadline}>期限: {habit.deadline_time.slice(0, 5)}</Text>
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
      {!isPro && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プレミアムプラン</Text>
          <View style={styles.proCard}>
            <Text style={styles.proCardTitle}>Proプランにアップグレード</Text>
            <Text style={styles.proCardDesc}>
              • 習慣を最大10個登録{'\n'}
              • 広告非表示{'\n'}
              • ¥300/月
            </Text>
            <TouchableOpacity
              style={[styles.proButton, isPurchaseLoading && styles.buttonDisabled]}
              onPress={purchasePro}
              disabled={isPurchaseLoading}
            >
              {isPurchaseLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.proButtonText}>アップグレードする</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.restoreButton} onPress={restorePurchases}>
              <Text style={styles.restoreButtonText}>購入を復元する</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* アカウント操作 */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.menuItem, styles.dangerItem]}
          onPress={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <Text style={[styles.menuItemText, styles.dangerText]}>ログアウト</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuItem, styles.dangerItem]}
          onPress={handleDeleteAccount}
        >
          <Text style={[styles.menuItemText, styles.dangerText]}>アカウントを削除する</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.border,
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  username: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  proBadge: {
    marginLeft: 'auto',
    backgroundColor: COLORS.secondary,
    borderRadius: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  menuItemArrow: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: SPACING.md,
  },
  habitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  habitDeadline: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  proCard: {
    backgroundColor: '#F0FDF9',
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  proCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  proCardDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  proButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  proButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  restoreButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  dangerItem: {
    borderColor: '#FFCDD2',
  },
  dangerText: {
    color: COLORS.danger,
  },
});
