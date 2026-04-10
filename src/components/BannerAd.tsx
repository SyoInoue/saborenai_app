/**
 * バナー広告コンポーネント
 * Proユーザーには非表示、Freeユーザーにはバナー広告を表示する
 */

import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd as AdMobBanner, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { usePurchase } from '@/providers/PurchaseProvider';
import { getBannerAdUnitId } from '@/lib/admob';
import { COLORS } from '@/constants/config';

const IS_DEV = __DEV__;

export const BannerAd = memo(function BannerAd() {
  const { isPro } = usePurchase();

  // Proユーザーは非表示
  if (isPro) return null;

  // 開発中はテスト用ID、本番は実際のID
  const adUnitId = IS_DEV ? TestIds.BANNER : getBannerAdUnitId();

  return (
    <View style={styles.container}>
      <AdMobBanner
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => {
          // ad load failures are non-fatal
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
