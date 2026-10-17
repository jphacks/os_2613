import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { colors } from './theme';
export function FeatureToggle({ value, disabled = false, label, onChange }: { value: boolean; disabled?: boolean; label: string; onChange: (value: boolean) => void }) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => { const animation = Animated.timing(position, { toValue: value ? 1 : 0, duration: 170, useNativeDriver: Platform.OS !== 'web' }); animation.start(); return () => animation.stop(); }, [value, position]);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} hitSlop={6} style={[s.toggle, value && s.on, disabled && { opacity: 0.4 }]}>
    <Animated.View pointerEvents="none" style={[s.thumb, { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }] }]} />
  </Pressable>;
}
const s = StyleSheet.create({ toggle: { width: 54, height: 32, flexShrink: 0, borderRadius: 16, backgroundColor: colors.line, padding: 3 }, on: { backgroundColor: colors.accent }, thumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, boxShadow: '0 1px 4px rgba(41,46,41,0.15)' } });
