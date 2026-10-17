export type DisplayPreferences = {
  fontSize: number;
  font: 'mincho' | 'gothic' | 'rounded' | 'textbook' | 'classic' | 'clean' | 'system';
  lineHeight: number;
  paper: 'light' | 'cream' | 'gray' | 'dark';
  paperColor?: string; // 色の表で選んだ紙の色（#RRGGBB）
  inkColor?: string; // 色の表で選んだ文字の色（#RRGGBB）
};
export const preferenceKey: string;
export const defaultPreferences: DisplayPreferences;
export const fontSizeRange: { min: number; max: number; step: number };
export const lineHeightRange: { min: number; max: number; step: number };
export const fontSizes: number[];
export const lineHeights: number[];
export const fontFamilies: Record<DisplayPreferences['font'], string>;
export function normalizePreferences(value: unknown): DisplayPreferences;

export const fontOptions: [DisplayPreferences['font'], string][];
