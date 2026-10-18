// 最後の本文の表示だけでは読了にせず、その先の終了ページが十分に見えた時に進む。
export function reachedEnding(scrollLeft, viewport, textPages) {
  return Number.isFinite(scrollLeft) && Number.isFinite(viewport) && viewport > 0 && Number.isInteger(textPages) && textPages > 0
    && -scrollLeft >= (textPages - .25) * viewport;
}
