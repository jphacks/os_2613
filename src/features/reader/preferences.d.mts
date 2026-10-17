export type DisplayPreferences = { fontSize: number; font: 'mincho' | 'gothic' | 'rounded' | 'textbook' | 'classic' | 'clean' | 'system'; lineHeight: number; paper: 'light' | 'cream' | 'gray' | 'dark' };
export const preferenceKey: string;
export const defaultPreferences: DisplayPreferences;
export const fontSizes: number[];
export const lineHeights: number[];
export const fontFamilies: Record<DisplayPreferences['font'], string>;
export function normalizePreferences(value: unknown): DisplayPreferences;

export const fontOptions: [DisplayPreferences['font'], string][];
