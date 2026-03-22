/**
 * オンボーディング画面
 * 3スライドのスワイプUI。最後のスライドで同意してログインへ進む。
 */

import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING } from '@/constants/config';

const { width } = Dimensions.get('window');

type Slide = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  bgColor: string;
};

const SLIDES: Slide[] = [
  {
    id: '1',
    title: 'サボったら\n自動投稿される',
    description:
      '習慣をサボると、自分のXアカウントに\n恥ずかしい投稿が自動で行われます。\n外圧で習慣を強制的に継続しよう。',
    emoji: '😱',
    bgColor: '#FF6B6B',
  },
  {
    id: '2',
    title: 'ペナルティは\n2種類',
    description:
      '📝 テキストモード\n「私はサボりました。だらしのない人間です。」\n\n📸 自撮りモード\n撮影済みの自撮り写真と一緒に投稿',
    emoji: '🐦',
    bgColor: '#4ECDC4',
  },
  {
    id: '3',
    title: '免責事項',
    description:
      '• 本アプリはXへの自動投稿を行います\n• 投稿を取り消す機能はありません\n• 習慣設定は責任を持って行ってください\n• ペナルティ投稿の内容はプレビューできます',
    emoji: '⚠️',
    bgColor: '#A78BFA',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/(auth)/login');
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      <LinearGradient
        colors={[item.bgColor, `${item.bgColor}CC`]}
        style={styles.gradient}
      >
        <Text style={styles.emoji}>{item.emoji}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* ドットインジケーター */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* ボタン */}
      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>
          {currentIndex === SLIDES.length - 1 ? '同意して始める' : '次へ'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  slide: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: 160,
  },
  emoji: {
    fontSize: 80,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    color: '#FFFFFFCC',
    textAlign: 'center',
    lineHeight: 26,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  dotInactive: {
    backgroundColor: COLORS.border,
  },
  button: {
    position: 'absolute',
    bottom: 48,
    left: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
