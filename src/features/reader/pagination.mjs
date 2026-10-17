// レイアウト計測は文字ノードで行い、表示するページだけを操作可能な文字に分ける。
function* measurementSteps(text, pageOf) {
  const offsets = [];
  let offset = 0;
  for (const char of text) { offsets.push(offset); offset += char.length; if (offsets.length % 4096 === 0) yield; }
  const starts = [0];
  if (!offsets.length) return [0, 0];
  const lastPage = pageOf(offsets[offsets.length - 1]);
  let low = 0;
  for (let page = 1; page <= lastPage; page++) {
    let left = low, right = offsets.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (pageOf(offsets[middle]) < page) left = middle + 1; else right = middle;
      yield;
    }
    if (left < offsets.length && offsets[left] > starts[starts.length - 1]) starts.push(offsets[left]);
    low = left;
  }
  return [...starts, text.length];
}
export function measuredPages(text, pageOf) {
  const steps = measurementSteps(text, pageOf);
  for (;;) { const result = steps.next(); if (result.done) return result.value; }
}
// 時間を区切ってブラウザーに制御を戻し、設定変更や閉じた画面の古い計測は破棄する。
export async function measuredPagesAsync(text, pageOf, { yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)), shouldCancel = () => false, now = () => performance.now(), budgetMs = 6 } = {}) {
  const steps = measurementSteps(text, pageOf);
  let since = now(), count = 0;
  for (;;) {
    if (shouldCancel()) return null;
    const result = steps.next();
    if (result.done) return result.value;
    if (++count >= 128 || now() - since >= budgetMs) {
      await yieldControl(); since = now(); count = 0;
    }
  }
}
export function pageAtOffset(starts, offset) {
  let left = 0, right = Math.max(0, starts.length - 2);
  while (left < right) {
    const middle = Math.ceil((left + right) / 2);
    if (starts[middle] <= offset) left = middle; else right = middle - 1;
  }
  return left;
}
export function pageFromTrack(x, width, count) {
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0 || count < 1) return 0;
  return Math.round((1 - Math.max(0, Math.min(1, x / width))) * (count - 1));
}
