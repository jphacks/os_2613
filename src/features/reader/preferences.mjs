export const preferenceKey = 'dopabooks:display:v1';
export const defaultPreferences = { fontSize: 17, font: 'mincho', lineHeight: 2, paper: 'light' };
export const fontSizes = [17, 18, 22, 24, 28, 32];
export const lineHeights = [1.5, 1.8, 2, 2.1, 2.5];
export function normalizePreferences(value) {
  return {
    fontSize: fontSizes.includes(value?.fontSize) ? value.fontSize : defaultPreferences.fontSize,
    font: ['mincho', 'gothic', 'rounded'].includes(value?.font) ? value.font : defaultPreferences.font,
    lineHeight: lineHeights.includes(value?.lineHeight) ? value.lineHeight : defaultPreferences.lineHeight,
    paper: ['light', 'cream', 'gray', 'dark'].includes(value?.paper) ? value.paper : defaultPreferences.paper,
  };
}
export const fontFamilies = {
  mincho: '"Yu Mincho", "Hiragino Mincho ProN", serif',
  gothic: '"Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',
  rounded: '"Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif',
};
