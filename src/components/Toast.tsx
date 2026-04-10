/**
 * トースト通知コンポーネント
 * API失敗・成功などの短時間フィードバックを画面上部に表示する
 */

import { memo, useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING } from '@/constants/config';

export type ToastType = 'success' | 'error' | 'info';

type Props = {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
};

/**
 * トースト通知を表示するコンポーネント
 * visible=true になると自動で表示→フェードアウトする
 */
export const Toast = memo(function Toast({ message, type = 'info', visible, onHide, duration = 3000 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // フェードイン
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // 一定時間後にフェードアウト
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onHide());
    }, duration);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const backgroundColor = {
    success: COLORS.success,
    error: COLORS.danger,
    info: COLORS.text,
  }[type];

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor }]}>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: SPACING.lg,
    right: SPACING.lg,
    borderRadius: 12,
    padding: SPACING.md,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
