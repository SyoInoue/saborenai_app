/**
 * ペナルティ設定画面
 * テキストモード/自撮りモードを選択し、DBに保存する
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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { COLORS, SPACING, PENALTY_TWEET_TEXT } from '@/constants/config';
import type { PenaltyType } from '@/types';

export default function PenaltySetup() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [selectedType, setSelectedType] = useState<PenaltyType>('text');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // 自撮りモードを選択したが自撮りがない場合は撮影画面へ
      if (selectedType === 'selfie' && !user.selfie_storage_path) {
        router.push('/(modals)/selfie-capture');
        return;
      }

      // penalty_typeとonboarding_completedを更新
      const { error } = await supabase
        .from('users')
        .update({
          penalty_type: selectedType,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      await refreshUser();
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('ペナルティ設定保存エラー:', error);
      Alert.alert('エラー', '設定の保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>ペナルティの種類を{'\n'}選択してください</Text>
      <Text style={styles.subtitle}>
        習慣をサボった際にXへ投稿される内容を選びます
      </Text>

      {/* テキストモード */}
      <TouchableOpacity
        style={[
          styles.card,
          selectedType === 'text' && styles.cardSelected,
        ]}
        onPress={() => setSelectedType('text')}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardEmoji}>📝</Text>
          <View style={styles.radioContainer}>
            <View style={[styles.radio, selectedType === 'text' && styles.radioSelected]} />
          </View>
        </View>
        <Text style={styles.cardTitle}>テキストのみ</Text>
        <Text style={styles.cardDescription}>サボった際に以下のテキストをXに投稿します</Text>
        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{PENALTY_TWEET_TEXT}</Text>
        </View>
      </TouchableOpacity>

      {/* 自撮りモード */}
      <TouchableOpacity
        style={[
          styles.card,
          selectedType === 'selfie' && styles.cardSelected,
        ]}
        onPress={() => setSelectedType('selfie')}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardEmoji}>📸</Text>
          <View style={styles.radioContainer}>
            <View style={[styles.radio, selectedType === 'selfie' && styles.radioSelected]} />
          </View>
        </View>
        <Text style={styles.cardTitle}>自撮り写真つき</Text>
        <Text style={styles.cardDescription}>
          事前に撮影した自撮り写真と一緒にテキストを投稿します
        </Text>
        {user?.selfie_storage_path ? (
          <View style={styles.selfieReadyBadge}>
            <Text style={styles.selfieReadyText}>✓ 自撮り撮影済み</Text>
          </View>
        ) : (
          <Text style={styles.selfieNotice}>
            ※ 次の画面でインカメラで自撮りを撮影します
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>
            {selectedType === 'selfie' && !user?.selfie_storage_path
              ? '次へ（自撮りを撮影する）'
              : 'この設定で始める'}
          </Text>
        )}
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
    marginBottom: SPACING.sm,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF5F5',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardEmoji: {
    fontSize: 32,
  },
  radioContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radio: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioSelected: {
    backgroundColor: COLORS.primary,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  previewBox: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
  },
  previewText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  selfieReadyBadge: {
    backgroundColor: '#D4EDDA',
    borderRadius: 8,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  selfieReadyText: {
    color: COLORS.success,
    fontWeight: 'bold',
    fontSize: 14,
  },
  selfieNotice: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
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
});
