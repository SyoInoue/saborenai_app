/**
 * Google AdMob 初期化・設定ユーティリティ
 */

import { Platform } from 'react-native';
import { ADMOB_BANNER_ID_IOS, ADMOB_BANNER_ID_ANDROID } from '@/constants/config';

/**
 * 現在のプラットフォームに応じたAdMobバナー広告IDを返す
 */
export function getBannerAdUnitId(): string {
  return Platform.OS === 'ios' ? ADMOB_BANNER_ID_IOS : ADMOB_BANNER_ID_ANDROID;
}
