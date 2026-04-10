/**
 * 画面遷移をまたいでトーストを表示するための一時ストア
 * add-habit などで set → 遷移先 (home) の useFocusEffect で consume する
 */

type ToastType = 'success' | 'error' | 'info';

let pending: { message: string; type: ToastType } | null = null;

export function setPendingToast(message: string, type: ToastType = 'success') {
  pending = { message, type };
}

export function consumePendingToast(): { message: string; type: ToastType } | null {
  const p = pending;
  pending = null;
  return p;
}

// 習慣作成直後フラグ（settings の spinner 表示用）
let _pendingCreation = false;
export function setPendingCreation() { _pendingCreation = true; }
export function consumePendingCreation(): boolean { const v = _pendingCreation; _pendingCreation = false; return v; }
export function isPendingCreation(): boolean { return _pendingCreation; }
