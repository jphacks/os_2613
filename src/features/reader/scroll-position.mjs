// RTLのスクロール位置は先頭が0、読み進める方向が負になる。
export function visibleScrollPage(scrollLeft, width, count) {
  if (!Number.isFinite(scrollLeft) || !Number.isFinite(width) || width <= 0 || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(-scrollLeft / width)));
}

// 右から45%までは紙面を動かさず、その位置を越えた分だけ追従する。
export function guideScrollLeft(scrollLeft, viewportRight, characterRight, width, scrollWidth, columnWidth = 0) {
  if (width <= 0) return 0;
  const distance = -scrollLeft + viewportRight - characterRight;
  const progress = Math.max(0, Math.min(Math.max(0, scrollWidth - width), distance - width * 0.45));
  return progress > 0 ? -progress : 0;
}

// フレーム間隔が変わっても同じ速さで追従し、目標位置を通り越さない。
export function smoothGuideScroll(current, target, elapsed) {
  if (![current, target, elapsed].every(Number.isFinite)) return current;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, elapsed) / 220));
}

// ページ境界から入ってくる文字も、強調していない間は同じ濃さにする。
export function guideOpacity(index, cursor, activePage = true) {
  return activePage ? Math.max(.5, 1 - Math.abs(index - cursor) * .13) : .5;
}

// 文字送りと同じ時間軸で、実測した列間の距離を補間する。
export function guideFramePosition(from, to, elapsed, duration) {
  return from + (to - from) * Math.max(0, Math.min(1, elapsed / Math.max(1, duration)));
}

// 空行を飛ばす補間はしない。実測した行が中心±行間の半分に入った間だけ、上から順に流す。
export function guideRowWave(rows, distance, spacing) {
  const half = spacing / 2;
  const row = rows.find(row => distance >= row.distance - half && distance < row.distance + half);
  if (!row || !row.indices.length) return null;
  const progress = Math.max(0, Math.min(1, (distance - row.distance + half) / spacing));
  return { index: row.indices[Math.min(row.indices.length - 1, Math.floor(progress * row.indices.length))], first: row.indices[0], last: row.indices[row.indices.length - 1] };
}
