export const preferenceKey = 'dopabooks:display:v1';
export const defaultPreferences = { fontSize: 17, font: 'mincho', lineHeight: 2, paper: 'light' };

// 文字サイズと行間は、調節バーで範囲の中の好きな値にできる（範囲外の値は標準に戻す）
export const fontSizeRange = { min: 14, max: 36, step: 1 };
export const lineHeightRange = { min: 1.3, max: 2.8, step: 0.1 };
// 以前の選択肢（他の画面やテストとの互換のため残す）
export const fontSizes = [17, 18, 22, 24, 28, 32];
export const lineHeights = [1.5, 1.8, 2, 2.1, 2.5];

const inRange = (n, range) => typeof n === 'number' && Number.isFinite(n) && n >= range.min && n <= range.max;
const isHex = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export function normalizePreferences(value) {
  const next = {
    fontSize: inRange(value?.fontSize, fontSizeRange) ? Math.round(value.fontSize) : defaultPreferences.fontSize,
    font: Object.keys(fontFamilies).includes(value?.font) ? value.font : defaultPreferences.font,
    lineHeight: inRange(value?.lineHeight, lineHeightRange) ? Math.round(value.lineHeight * 10) / 10 : defaultPreferences.lineHeight,
    paper: ['light', 'cream', 'gray', 'dark'].includes(value?.paper) ? value.paper : defaultPreferences.paper,
  };
  // 色の表で選んだ紙の色・文字の色（#RRGGBB）。選んでいなければ項目ごと持たない
  if (isHex(value?.paperColor)) next.paperColor = value.paperColor.toUpperCase();
  if (isHex(value?.inkColor)) next.inkColor = value.inkColor.toUpperCase();
  return next;
}

export const fontFamilies = {
  mincho: '"Yu Mincho", "Hiragino Mincho ProN", serif',
  gothic: '"Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',
  textbook: '"UD Digi Kyokasho N-R", "Yu Kyokasho", "Hiragino Mincho ProN", serif',
  classic: '"MS PMincho", "Hiragino Mincho ProN", serif',
  clean: '"Meiryo", "Hiragino Sans", sans-serif',
  system: 'system-ui, -apple-system, sans-serif',
  rounded: '"Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif',
};

export const fontOptions = [['mincho', '明朝'], ['gothic', 'ゴシック'], ['rounded', '丸ゴシック'], ['textbook', '教科書体'], ['classic', 'クラシック明朝'], ['clean', '読みやすいゴシック'], ['system', 'システム標準']];
