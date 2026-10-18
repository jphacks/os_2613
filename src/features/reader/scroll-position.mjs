// RTLのスクロール位置は先頭が0、読み進める方向が負になる。
export function visibleScrollPage(scrollLeft, width, count) {
  if (!Number.isFinite(scrollLeft) || !Number.isFinite(width) || width <= 0 || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(-scrollLeft / width)));
}
