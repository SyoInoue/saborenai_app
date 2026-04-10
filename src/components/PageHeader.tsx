import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS } from '@/constants/config';

type Props = { title: string };

export const PageHeader = memo(function PageHeader({ title }: Props) {
  const lineAnim = useRef(new Animated.Value(0)).current;
  const arrowOpacity = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const firstPlayDone = useRef(false);

  const play = useCallback(() => {
    if (textWidth === 0) return;
    lineAnim.setValue(0);
    arrowOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(lineAnim, {
        toValue: textWidth,
        duration: 500,
        useNativeDriver: false,
      }),
      Animated.timing(arrowOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [textWidth]);

  // テキスト幅が確定したら初回再生
  useEffect(() => {
    if (textWidth > 0 && !firstPlayDone.current) {
      firstPlayDone.current = true;
      play();
    }
  }, [textWidth]);

  // タブ切り替えのたびに再生
  useFocusEffect(
    useCallback(() => {
      if (firstPlayDone.current) play();
    }, [play])
  );

  return (
    <View style={styles.header}>
      <Text
        style={styles.title}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
      >
        {title}
      </Text>
      <View style={[styles.row, { width: textWidth || undefined }]}>
        <Animated.View style={[styles.line, { width: lineAnim }]} />
        <Animated.Text style={[styles.arrow, { opacity: arrowOpacity }]}>
          ▶
        </Animated.Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 3,
  },
  row: {
    marginTop: 6,
    height: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    height: 2,
    backgroundColor: COLORS.primary,
  },
  arrow: {
    fontSize: 8,
    color: COLORS.primary,
    lineHeight: 10,
    marginLeft: 1,
  },
});
