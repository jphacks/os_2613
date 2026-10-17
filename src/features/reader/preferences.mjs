export const preferenceKey = 'dopabooks:display:v1';
export const defaultPreferences = { fontSize: 17, font: 'mincho', lineHeight: 2, paper: 'light' };
export const fontSizes = [17, 18, 22, 24, 28, 32];
export const lineHeights = [1.5, 1.8, 2, 2.1, 2.5];
export function normalizePreferences(value) {
  return {
    fontSize: fontSizes.includes(value?.fontSize) ? value.fontSize : defaultPreferences.fontSize,
    font: Object.keys(fontFamilies).includes(value?.font) ? value.font : defaultPreferences.font,
    lineHeight: lineHeights.includes(value?.lineHeight) ? value.lineHeight : defaultPreferences.lineHeight,
    paper: ['light', 'cream', 'gray', 'dark'].includes(value?.paper) ? value.paper : defaultPreferences.paper,
  };
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
