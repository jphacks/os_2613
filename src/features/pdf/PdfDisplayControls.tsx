import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';

type Props = { zoom: number; spread: boolean; onZoom: (zoom: number) => void; onSpread: (spread: boolean) => void };

export function PdfDisplayControls({ zoom, spread, onZoom, onSpread }: Props) {
  const [width, setWidth] = useState(1);
  const change = (value: number) => onZoom(Math.max(0.5, Math.min(3, Math.round(value * 20) / 20)));
  const button = (label: string, onPress: () => void, selected?: boolean) => <Pressable accessibilityRole="button" accessibilityState={selected === undefined ? undefined : { selected }} onPress={onPress} style={[styles.button, selected && styles.active]}><Text style={[styles.text, selected && styles.activeText]}>{label}</Text></Pressable>;
  return <View style={styles.row}>
    <Text style={styles.text}>拡大率</Text>
    {Platform.OS === 'web' ? <input type="range" aria-label="原文PDFの拡大率" min={50} max={300} step={5} value={Math.round(zoom * 100)} onChange={event => change(Number(event.target.value) / 100)} style={{ width: 130, accentColor: colors.accent, margin: 0 }} />
      : <View accessible accessibilityRole="adjustable" accessibilityLabel="原文PDFの拡大率" accessibilityValue={{ min: 50, max: 300, now: Math.round(zoom * 100), text: `${Math.round(zoom * 100)}%` }}
        accessibilityActions={[{ name: 'increment', label: '拡大' }, { name: 'decrement', label: '縮小' }]}
        onAccessibilityAction={event => change(zoom + (event.nativeEvent.actionName === 'increment' ? .05 : -.05))}
        onLayout={event => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={event => change(.5 + event.nativeEvent.locationX / width * 2.5)} onResponderMove={event => change(.5 + event.nativeEvent.locationX / width * 2.5)} style={styles.slider}>
        <View pointerEvents="none" style={styles.track}><View style={[styles.fill, { width: `${(zoom - .5) / 2.5 * 100}%` }]} /></View>
        <View pointerEvents="none" style={[styles.thumb, { left: `${(zoom - .5) / 2.5 * 100}%` }]} />
      </View>}
    <Text style={[styles.text, styles.value]}>{Math.round(zoom * 100)}%</Text>
    {button('全体表示', () => onZoom(1))}
    {button('1ページ', () => onSpread(false), !spread)}
    {button('見開き', () => onSpread(true), spread)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  text: { fontSize: 12, color: colors.ink }, value: { width: 38, fontVariant: ['tabular-nums'] },
  button: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface },
  active: { backgroundColor: colors.accent, borderColor: colors.accent }, activeText: { color: colors.surface },
  slider: { width: 130, height: 36, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' }, fill: { height: 5, backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 18, height: 18, borderRadius: 9, marginLeft: -9, top: 9, backgroundColor: colors.accent },
});
