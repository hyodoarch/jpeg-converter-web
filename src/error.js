export function imageError(error) {
  const message = error?.message || '画像を変換できませんでした。';
  if (/InsufficientImageData|CorruptImage|NotAJPEG|Invalid input|bad seek/i.test(message)) return '画像データが破損しているか、対応していない形式です。別の画像を選択してください。';
  if (/memory|ResourceLimit|PixelCache|allocation|out of bounds/i.test(message)) return '画像の処理に必要なメモリを確保できませんでした。小さい画像、または少ない枚数でお試しください。';
  if (/fetch|NetworkError|Failed to load|CompileError/i.test(message)) return '画像処理エンジンを読み込めませんでした。通信状態を確認してページを開き直してください。';
  return message;
}
