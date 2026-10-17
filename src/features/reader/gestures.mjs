export function horizontalTurn(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return null;
  return dx > 0 ? 'next' : 'prev';
}
export function edgeTurn(x, left, width) {
  if (![x, left, width].every(Number.isFinite) || width <= 0 || x < left || x > left + width) return null;
  const edge = Math.min(80, width * 0.15);
  return x <= left + edge ? 'next' : x >= left + width - edge ? 'prev' : null;
}
export function pageForAnchor(offsets, pageOf, anchor) {
  const index = offsets.findIndex(offset => offset > anchor);
  return pageOf[index < 0 ? Math.max(0, offsets.length - 1) : index] ?? 0;
}
