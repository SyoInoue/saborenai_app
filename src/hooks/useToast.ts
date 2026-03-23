/**
 * トースト通知カスタムフック
 * showToast() を呼ぶだけでToastコンポーネントを制御できる
 */

import { useState, useCallback } from 'react';
import type { ToastType } from '@/components/Toast';

type ToastState = {
  message: string;
  type: ToastType;
  visible: boolean;
};

type UseToastReturn = {
  toast: ToastState;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
};

/**
 * トースト通知を管理するフック
 * @example
 * const { toast, showToast, hideToast } = useToast();
 * showToast('保存しました', 'success');
 */
export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'info',
    visible: false,
  });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toast, showToast, hideToast };
}
