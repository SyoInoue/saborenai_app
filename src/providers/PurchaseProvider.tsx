/**
 * 課金プロバイダー
 * RevenueCat を使ってApp Store課金を管理する
 */

import React, { createContext, useContext, useEffect, useReducer } from 'react';
import Purchases, { LOG_LEVEL, CustomerInfo } from 'react-native-purchases';
import { Platform, Alert } from 'react-native';
import {
  REVENUECAT_PRO_PRODUCT_ID_MONTHLY,
  REVENUECAT_PRO_PRODUCT_ID_YEARLY,
} from '@/constants/config';
import type { PurchaseContextType, ProPlan } from '@/types';

// =====================================================
// 定数
// =====================================================

// RevenueCat APIキー（環境変数から取得）
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';

// =====================================================
// コンテキスト定義
// =====================================================

const PurchaseContext = createContext<PurchaseContextType | null>(null);

// =====================================================
// 状態管理
// =====================================================

type PurchaseState = {
  isPro: boolean;
  isLoading: boolean;
};

type PurchaseAction =
  | { type: 'SET_PRO'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean };

function purchaseReducer(state: PurchaseState, action: PurchaseAction): PurchaseState {
  switch (action.type) {
    case 'SET_PRO':
      return { ...state, isPro: action.payload, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

/**
 * CustomerInfo から Pro かどうかを判定する
 */
function checkIsPro(customerInfo: CustomerInfo): boolean {
  return (
    typeof customerInfo.entitlements.active['pro'] !== 'undefined'
  );
}

// =====================================================
// PurchaseProvider コンポーネント
// =====================================================

type Props = {
  children: React.ReactNode;
};

export function PurchaseProvider({ children }: Props) {
  const [state, dispatch] = useReducer(purchaseReducer, {
    isPro: false,
    isLoading: true,
  });

  useEffect(() => {
    // RevenueCat 初期化
    if (Platform.OS === 'ios') {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
    }

    // 現在のサブスクリプション状態を取得
    const fetchCustomerInfo = async () => {
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        dispatch({ type: 'SET_PRO', payload: checkIsPro(customerInfo) });
      } catch (error) {
        console.error('RevenueCat customerInfo取得エラー:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    fetchCustomerInfo();

    // サブスクリプション状態変化を監視
    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      dispatch({ type: 'SET_PRO', payload: checkIsPro(customerInfo) });
    });
  }, []);

  /**
   * Proプランを購入する（月額 or 年額）
   */
  const purchasePro = async (plan: ProPlan = 'monthly'): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    const targetProductId =
      plan === 'yearly'
        ? REVENUECAT_PRO_PRODUCT_ID_YEARLY
        : REVENUECAT_PRO_PRODUCT_ID_MONTHLY;

    try {
      const offerings = await Purchases.getOfferings();
      const proPackage = offerings.current?.availablePackages.find(
        (pkg) => pkg.product.identifier === targetProductId
      );

      if (!proPackage) {
        Alert.alert('エラー', '購入できる商品が見つかりませんでした。');
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(proPackage);
      dispatch({ type: 'SET_PRO', payload: checkIsPro(customerInfo) });
    } catch (error: unknown) {
      // ユーザーがキャンセルした場合は無視
      const purchaseError = error as { userCancelled?: boolean };
      if (!purchaseError.userCancelled) {
        console.error('購入エラー:', error);
        Alert.alert('購入エラー', '購入処理に失敗しました。もう一度お試しください。');
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  /**
   * 過去の購入を復元する
   */
  const restorePurchases = async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPro = checkIsPro(customerInfo);
      dispatch({ type: 'SET_PRO', payload: isPro });

      Alert.alert(
        '復元完了',
        isPro ? 'Proプランを復元しました！' : '復元できる購入履歴がありませんでした。'
      );
    } catch (error) {
      console.error('復元エラー:', error);
      Alert.alert('復元エラー', '購入の復元に失敗しました。');
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const value: PurchaseContextType = {
    isPro: state.isPro,
    isLoading: state.isLoading,
    purchasePro: (plan?: ProPlan) => purchasePro(plan),
    restorePurchases,
  };

  return (
    <PurchaseContext.Provider value={value}>
      {children}
    </PurchaseContext.Provider>
  );
}

// =====================================================
// カスタムフック
// =====================================================

/**
 * 課金コンテキストを使用するカスタムフック
 */
export function usePurchase(): PurchaseContextType {
  const context = useContext(PurchaseContext);
  if (!context) {
    throw new Error('usePurchase は PurchaseProvider 内で使用してください');
  }
  return context;
}
