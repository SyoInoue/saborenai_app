/**
 * スケルトンローディングコンポーネント
 * データ読み込み中にプレースホルダーを表示する
 */

import { memo, useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '@/constants/config';

type SkeletonBoxProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: object;
};

/**
 * アニメーション付きスケルトンボックス
 */
export const SkeletonBox = memo(function SkeletonBox({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 明滅アニメーション
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
});

/**
 * HabitCard のスケルトン（ローディング中に表示）
 */
export const HabitCardSkeleton = memo(function HabitCardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.cardHeader}>
        <SkeletonBox width="60%" height={20} />
        <SkeletonBox width={60} height={24} borderRadius={12} />
      </View>
      <SkeletonBox width="40%" height={14} style={{ marginTop: SPACING.xs }} />
      <SkeletonBox width="100%" height={44} borderRadius={12} style={{ marginTop: SPACING.md }} />
    </View>
  );
});

/**
 * ストリークカードのスケルトン
 */
export const StreakSkeleton = memo(function StreakSkeleton() {
  return (
    <View style={styles.streakSkeleton}>
      <SkeletonBox width={56} height={56} borderRadius={28} />
      <View style={styles.streakTextArea}>
        <SkeletonBox width="50%" height={28} />
        <SkeletonBox width="70%" height={14} style={{ marginTop: SPACING.xs }} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.border,
  },
  cardSkeleton: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  streakTextArea: {
    flex: 1,
    gap: SPACING.xs,
  },
});
