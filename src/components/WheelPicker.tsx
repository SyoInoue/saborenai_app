/**
 * スクロールホイールピッカー
 * スナップスクロール + ハプティクスで「カチカチ」感を実現
 */

import { useRef, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants/config';

const ITEM_HEIGHT = 56;
const VISIBLE_COUNT = 3; // 奇数にすること（中央が選択状態）

interface WheelPickerProps {
  values: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width?: number;
}

export function WheelPicker({ values, selectedIndex, onSelect, width = 90 }: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const hasMomentum = useRef(false);
  const lastHapticIndex = useRef(-1);
  const isUserScrolling = useRef(false);
  const padding = Math.floor(VISIBLE_COUNT / 2);

  // 初期スクロール位置を設定（ユーザー操作中は無視）
  useEffect(() => {
    if (isUserScrolling.current) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  // スクロール中にインデックスが変わるたびに軽いバイブ（カチカチ感）
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.max(0, Math.min(values.length - 1, Math.round(y / ITEM_HEIGHT)));
      if (index !== lastHapticIndex.current) {
        lastHapticIndex.current = index;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [values.length]
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.max(0, Math.min(values.length - 1, Math.round(y / ITEM_HEIGHT)));
      isUserScrolling.current = false;
      onSelect(index);
    },
    [values.length, onSelect]
  );

  return (
    <View style={[styles.container, { width }]}>
      {/* 選択中アイテムのハイライト枠 */}
      <View
        style={[styles.selector, { top: ITEM_HEIGHT * padding }]}
        pointerEvents="none"
      />

      {/* 上下フェード */}
      <View style={styles.fadeTop} pointerEvents="none" />
      <View style={styles.fadeBottom} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        scrollEventThrottle={16}
        overScrollMode="never"
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          hasMomentum.current = false;
          isUserScrolling.current = true;
          lastHapticIndex.current = -1;
        }}
        onMomentumScrollBegin={() => { hasMomentum.current = true; }}
        onScrollEndDrag={(e) => {
          if (!hasMomentum.current) handleScrollEnd(e);
        }}
        onMomentumScrollEnd={(e) => {
          hasMomentum.current = false;
          handleScrollEnd(e);
        }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * padding }}
      >
        {values.map((value, index) => {
          const diff = Math.abs(index - selectedIndex);
          return (
            <View key={index} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  diff === 0 && styles.selectedText,
                  diff === 1 && styles.nearText,
                  diff >= 2 && styles.farText,
                ]}
              >
                {value}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_COUNT,
    overflow: 'hidden',
    position: 'relative',
  },
  selector: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: ITEM_HEIGHT,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 4,
    zIndex: 1,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: COLORS.surface,
    opacity: 0.7,
    zIndex: 2,
    pointerEvents: 'none',
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: COLORS.surface,
    opacity: 0.7,
    zIndex: 2,
    pointerEvents: 'none',
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    opacity: 0.4,
  },
  nearText: {
    fontSize: 18,
    opacity: 0.6,
  },
  selectedText: {
    fontSize: 34,
    fontWeight: 'bold',
    color: COLORS.primary,
    opacity: 1,
  },
  farText: {
    fontSize: 14,
    opacity: 0.2,
  },
});
