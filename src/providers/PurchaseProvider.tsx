/**
 * 課金プロバイダー（スタブ実装）
 * Phase 5で RevenueCat を統合する。現時点では無料ユーザーとして動作。
 */

import React, { createContext, useContext, useState } from 'react';
import type { PurchaseContextType } from '@/types';

const PurchaseContext = createContext<PurchaseContextType | null>(null);

type Props = {
  children: React.ReactNode;
};

export function PurchaseProvider({ children }: Props) {
  // TODO: Phase 5で RevenueCat の isPro に差し替える
  const [isPro] = useState(false);
  const [isLoading] = useState(false);

  const purchasePro = async (): Promise<void> => {
    // TODO: Phase 5で実装
    console.log('purchasePro: 未実装');
  };

  const restorePurchases = async (): Promise<void> => {
    // TODO: Phase 5で実装
    console.log('restorePurchases: 未実装');
  };

  const value: PurchaseContextType = {
    isPro,
    isLoading,
    purchasePro,
    restorePurchases,
  };

  return (
    <PurchaseContext.Provider value={value}>
      {children}
    </PurchaseContext.Provider>
  );
}

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
