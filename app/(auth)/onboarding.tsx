/**
 * オンボーディング画面
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/constants/config';

const { width } = Dimensions.get('window');

type Slide = {
  id: string;
  number: string;
  title: string;
  description: string;
  iconName: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
};

const SLIDES: Slide[] = [
  {
    id: '1',
    number: '01',
    title: 'サボったら\n自動投稿される',
    description: '習慣をサボると、自分のXアカウントに\n恥ずかしい投稿が自動で行われます。\n外圧で習慣を強制的に継続しよう。',
    iconName: 'flash',
  },
  {
    id: '2',
    number: '02',
    title: 'ペナルティは\nテキストで設定',
    description: '「私はサボりました。」など\nサボった時に投稿されるテキストを\n自分で設定できます。',
    iconName: 'document-text',
  },
  {
    id: '3',
    number: '03',
    title: '免責事項',
    description: '• 本アプリはXへの自動投稿を行います\n• 投稿を取り消す機能はありません\n• 習慣設定は責任を持って行ってください\n• ペナルティ投稿の内容はプレビューできます',
    iconName: 'warning',
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
      <View style={styles.slideInner}>
        {/* スライド番号 */}
        <Text style={styles.slideNumber}>{item.number}</Text>
        <View style={styles.dividerLine} />

        {/* アイコン */}
        <View style={styles.iconWrap}>
          <Ionicons name={item.iconName} size={48} color={COLORS.primary} />
        </View>

        {/* タイトル */}
        <Text style={styles.title}>{item.title}</Text>

        {/* 説明 */}
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 背景ロゴ */}
      <Image
        source={require('../../assets/yaraneva_bg_overlay.png')}
        style={styles.bgOverlay}
        resizeMode="cover"
      />

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

      {/* ボトムエリア */}
      <View style={styles.bottom}>
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
          <Ionicons
            name={currentIndex === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  slide: {
    flex: 1,
  },
  slideInner: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: 100,
    paddingBottom: 200,
  },
  slideNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: COLORS.primary,
    lineHeight: 64,
    letterSpacing: -2,
    marginBottom: SPACING.sm,
  },
  dividerLine: {
    height: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  iconWrap: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 26,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.xl,
    paddingBottom: 48,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  dot: {
    height: 3,
    borderRadius: 2,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  dotInactive: {
    backgroundColor: COLORS.border,
    width: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    minHeight: 52,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
