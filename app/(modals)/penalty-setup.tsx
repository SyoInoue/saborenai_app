/**
 * ペナルティ設定画面（オンボーディング）
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { COLORS, SPACING, PENALTY_TWEET_TEXT } from '@/constants/config';

export default function PenaltySetup() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const handleStart = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ penalty_type: 'text', onboarding_completed: true })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      await refreshUser();
      router.replace('/(tabs)/home');
    } catch {
      Alert.alert('エラー', '設定の保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 上部アクセントライン */}
      <View style={styles.topAccent} />

      {/* タイトルエリア */}
      <View style={styles.heroArea}>
        <Text style={styles.label}>PENALTY SYSTEM</Text>
        <Text style={styles.title}>サボったら{'\n'}Xに晒されます</Text>
        <Text style={styles.subtitle}>
          習慣の期限を過ぎると、設定したペナルティテキストが{'\n'}あなたのXアカウントに自動投稿されます。
        </Text>
      </View>

      {/* 仕組み説明 */}
      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>HOW IT WORKS</Text>
        <View style={styles.stepRow}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
          <Text style={styles.stepText}>習慣と期限を設定する</Text>
        </View>
        <View style={styles.stepDivider} />
        <View style={styles.stepRow}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
          <Text style={styles.stepText}>期限までに完了しないとペナルティ発動</Text>
        </View>
        <View style={styles.stepDivider} />
        <View style={styles.stepRow}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
          <Text style={styles.stepText}>あなたのXに自動で投稿される</Text>
        </View>
      </View>

      {/* 投稿プレビュー */}
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>POST PREVIEW</Text>
        <View style={styles.previewBox}>
          <View style={styles.previewAccent} />
          <Text style={styles.previewText}>
            {'【筋トレ30分】\n'}
            {PENALTY_TWEET_TEXT}
            {'\n\n#サボれない習慣化アプリ #YARANEVA\n📅 2026/03/24 21:00:00'}
          </Text>
        </View>
        <Text style={styles.previewNote}>
          ※ ペナルティテキストは習慣ごとにカスタマイズできます
        </Text>
      </View>

      {/* 注意事項 */}
      <View style={styles.warningCard}>
        <Ionicons name="warning" size={16} color={COLORS.warning} />
        <Text style={styles.warningText}>
          投稿されたツイートを取り消す機能はありません。習慣設定は責任を持って行ってください。
        </Text>
      </View>

      {/* 開始ボタン */}
      <TouchableOpacity
        style={[styles.startButton, isSaving && styles.buttonDisabled]}
        onPress={handleStart}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.startButtonText}>はじめる</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 48 },
  topAccent: { height: 3, backgroundColor: COLORS.primary },
  heroArea: {
    padding: SPACING.xl,
    paddingTop: SPACING.xl * 2,
    paddingBottom: SPACING.xl,
  },
  label: {
    fontSize: 10, fontWeight: '800', color: COLORS.primary,
    letterSpacing: 3, marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 36, fontWeight: '900', color: COLORS.text,
    lineHeight: 44, letterSpacing: -0.5, marginBottom: SPACING.md,
  },
  subtitle: {
    fontSize: 14, color: COLORS.textSecondary,
    lineHeight: 22,
  },
  stepsCard: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: 8,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  stepsTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 3, marginBottom: SPACING.md,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  stepNum: {
    width: 24, height: 24, borderRadius: 4,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  stepText: { fontSize: 14, color: COLORS.text, fontWeight: '600', flex: 1 },
  stepDivider: {
    height: 1, backgroundColor: COLORS.border,
    marginVertical: SPACING.sm, marginLeft: 36,
  },
  previewCard: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: 8,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  previewLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 3, marginBottom: SPACING.sm,
  },
  previewBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 4, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  previewAccent: { width: 3, backgroundColor: COLORS.primary },
  previewText: {
    flex: 1, fontSize: 13, color: COLORS.text,
    lineHeight: 22, padding: SPACING.sm,
  },
  previewNote: { fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },
  warningCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.xl,
    backgroundColor: '#1A0F00', borderRadius: 8,
    padding: SPACING.md, borderWidth: 1, borderColor: '#3A2000',
  },
  warningText: {
    flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18,
  },
  startButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: SPACING.md, marginHorizontal: SPACING.xl,
    minHeight: 52,
  },
  buttonDisabled: { opacity: 0.5 },
  startButtonText: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase',
  },
});
