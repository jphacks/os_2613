import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';
export function NavigationButton({ onPress, label = '戻る', close = false, disabled = false }: { onPress: () => void; label?: string; close?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, pressed && { backgroundColor: colors.line }, disabled && { opacity: 0.4 }]}>
    {close ? <Text style={s.cross}>×</Text> : <View style={s.chevron} />}
    <Text numberOfLines={1} style={s.label}>{label}</Text>
  </Pressable>;
}
const s = StyleSheet.create({ button: { flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 14, marginHorizontal: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: colors.surface, flexShrink: 0 }, chevron: { width: 9, height: 9, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.accent, transform: [{ rotate: '45deg' }], marginLeft: 3 }, cross: { color: colors.accent, fontSize: 23, lineHeight: 25 }, label: { color: colors.accent, fontSize: 13, fontWeight: '600' } });
