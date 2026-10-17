// レイアウト計測は文字ノードで行い、表示するページだけを操作可能な文字に分ける。
export function measuredPages(text, pageOf) {
  const offsets = [];
  let offset = 0;
  for (const char of text) { offsets.push(offset); offset += char.length; }
  const starts = [0];
  if (!offsets.length) return [0, 0];
  const lastPage = pageOf(offsets[offsets.length - 1]);
  let low = 0;
  for (let page = 1; page <= lastPage; page++) {
    let left = low, right = offsets.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (pageOf(offsets[middle]) < page) left = middle + 1; else right = middle;
    }
    if (left < offsets.length && offsets[left] > starts[starts.length - 1]) starts.push(offsets[left]);
    low = left;
  }
  return [...starts, text.length];
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
