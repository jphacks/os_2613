export function sheetHeights(height) {
  const full = Math.max(120, height * .70);
  return { compact: Math.min(full, Math.max(120, height * .50)), full };
}
export function sheetDestination(start, dy, velocity, height) {
  const { compact, full } = sheetHeights(height);
  const projected = start - dy - velocity * 100;
  if ((dy > 55 && velocity > .65) || projected < compact * .55) return 0;
  return projected > (compact + full) / 2 ? full : compact;
}
