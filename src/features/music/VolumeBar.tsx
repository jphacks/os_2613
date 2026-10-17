import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';

export function VolumeBar({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(1);
  const change = (x: number) => onChange(Math.max(0, Math.min(1, x / width)));
  return <View style={styles.row}>
    <Text style={styles.label}>音量 {Math.round(value * 100)}%</Text>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="BGM音量" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment', label: '音量を上げる' }, { name: 'decrement', label: '音量を下げる' }]}
      onAccessibilityAction={event => onChange(Math.max(0, Math.min(1, value + (event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}
      onLayout={event => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={event => change(event.nativeEvent.locationX)} onResponderMove={event => change(event.nativeEvent.locationX)} style={styles.touch}>
      <View pointerEvents="none" style={styles.track}><View style={[styles.fill, { width: `${value * 100}%` }]} /></View>
      <View pointerEvents="none" style={[styles.thumb, { left: `${value * 100}%` }]} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }, label: { color: colors.ink, fontSize: 13, width: 80 },
  touch: { flex: 1, height: 36, justifyContent: 'center', marginHorizontal: 10 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.line }, fill: { height: 5, backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 18, height: 18, borderRadius: 9, marginLeft: -9, top: 9, backgroundColor: colors.accent },
});
