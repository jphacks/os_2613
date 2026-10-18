// RTLのスクロール位置は先頭が0、読み進める方向が負になる。
export function visibleScrollPage(scrollLeft, width, count) {
  if (!Number.isFinite(scrollLeft) || !Number.isFinite(width) || width <= 0 || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(-scrollLeft / width)));
}

// 強調中の列が画面の右から約1/3の位置に来るように追従する。
export function guideScrollLeft(scrollLeft, viewportRight, characterRight, width, scrollWidth) {
  if (width <= 0) return 0;
  const distance = -scrollLeft + viewportRight - characterRight;
  const progress = Math.max(0, Math.min(Math.max(0, scrollWidth - width), distance - width * 0.35));
  return progress > 0 ? -progress : 0;
}
