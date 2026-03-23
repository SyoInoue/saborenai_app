/**
 * モーダル間でデータを受け渡すための一時ストア
 * selfie-capture → add-habit への自撮りパス受け渡しに使用
 */

let pendingSefliePath: string | null = null;

export const tempStore = {
  getSefliePath: (): string | null => pendingSefliePath,
  setSefliePath: (path: string | null): void => {
    pendingSefliePath = path;
  },
};
