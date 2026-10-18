import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { pageFromTrack } from './pagination.mjs';

export function PageBar({ page, count, disabled, ink, accent, line, onChange }: { page: number; count: number; disabled: boolean; ink: string; accent: string; line: string; onChange: (page: number) => void }) {
  const width = useRef(0), latest = useRef(page), dragging = useRef(false);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = Math.min(count - 1, preview ?? page);
  function update(x: number) { latest.current = pageFromTrack(x, width.current, count); setPreview(latest.current); }
  return <View style={styles.row}>
    <Text style={{ color: ink, fontSize: 12, textAlign: 'center' }}>{shown + 1} / {count} ページ</Text>
    <View accessibilityRole="adjustable" accessibilityLabel="ページ移動" accessibilityState={{ disabled }}
      aria-valuemin={1} aria-valuemax={count} aria-valuenow={shown + 1} aria-valuetext={`${shown + 1} / ${count} ページ`}
      accessibilityValue={{ min: 1, max: count, now: shown + 1, text: `${shown + 1} / ${count} ページ` }}
      accessibilityActions={[{ name: 'increment', label: '次のページ' }, { name: 'decrement', label: '前のページ' }]}
      onAccessibilityAction={event => { if (!disabled) onChange(Math.max(0, Math.min(count - 1, page + (event.nativeEvent.actionName === 'increment' ? 1 : -1)))); }}
      onLayout={event => { width.current = event.nativeEvent.layout.width; }}
      onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={event => { dragging.current = true; update(event.nativeEvent.locationX); }}
      onResponderMove={event => update(event.nativeEvent.locationX)}
      onResponderRelease={() => { if (dragging.current) onChange(latest.current); dragging.current = false; setPreview(null); }}
      onResponderTerminate={() => { dragging.current = false; setPreview(null); }}
      style={[styles.touch, { opacity: disabled ? 0.4 : 1 }]}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: line }]}>
        <View style={[styles.fill, { backgroundColor: accent, width: `${count <= 1 ? 100 : shown / (count - 1) * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { backgroundColor: accent, right: `${count <= 1 ? 0 : shown / (count - 1) * 100}%` }]} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'column', alignItems: 'stretch', gap: 0, paddingHorizontal: 20 },
  touch: { width: '100%', height: 32, justifyContent: 'center' }, track: { height: 5, borderRadius: 3, overflow: 'hidden', flexDirection: 'row-reverse' },
  fill: { height: 5 }, thumb: { position: 'absolute', top: 9, width: 14, height: 14, borderRadius: 7, marginRight: -7 },
});
