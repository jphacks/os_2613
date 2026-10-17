import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/shared/theme';
export function GuideSpeed({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(1), [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const set = (n: number) => onChange(Math.max(120, Math.min(3000, Math.round(n))));
  const move = (x: number) => set(120 + Math.max(0, Math.min(1, x / width)) * 2880);
  const ratio = (value - 120) / 2880;
  return <View style={s.box}><View style={s.row}><Text style={s.label}>読む速さ</Text><TextInput accessibilityLabel="読みガイドの速さ" keyboardType="number-pad" value={draft} onChangeText={setDraft} onBlur={() => { if (draft.trim() && Number.isFinite(Number(draft))) set(Number(draft)); else setDraft(String(value)); }} onSubmitEditing={() => { if (draft.trim() && Number.isFinite(Number(draft))) set(Number(draft)); }} style={s.input} /><Text style={s.unit}>字／分</Text></View>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="読む速さ" accessibilityValue={{ min: 120, max: 3000, now: value }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => set(value + (e.nativeEvent.actionName === 'increment' ? 100 : -100))} onLayout={e => setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={e => move(e.nativeEvent.locationX)} onResponderMove={e => move(e.nativeEvent.locationX)} style={s.slider}>
      <View pointerEvents="none" style={s.track}><View style={[s.fill, { width: `${ratio * 100}%` }]} /></View><View pointerEvents="none" style={[s.thumb, { left: `${ratio * 100}%` }]} />
    </View><View style={s.row}><Text style={s.unit}>ゆっくり 120</Text><View style={{ flex: 1 }} /><Text style={s.unit}>3000 はやく</Text></View>
  </View>;
}
const s = StyleSheet.create({ box: { gap: 2 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, label: { flex: 1, color: colors.ink, fontSize: 13 }, unit: { color: colors.muted, fontSize: 11 }, input: { width: 72, padding: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.line, color: colors.ink, textAlign: 'center' }, slider: { height: 40, justifyContent: 'center', marginHorizontal: 10 }, track: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' }, fill: { height: 4, backgroundColor: colors.accent }, thumb: { position: 'absolute', top: 10, width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: colors.accent } });
