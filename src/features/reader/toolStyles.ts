import { colors } from '@/shared/theme';

// Both symbols occupy the same square, with font padding excluded on Android.
export const readerToolButton = { width: 38, height: 38, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 0 };
export const readerToolSymbol = { width: 30, height: 30, lineHeight: 30, textAlign: 'center' as const, textAlignVertical: 'center' as const, includeFontPadding: false, fontSize: 25, fontWeight: '700' as const, color: colors.accent };
