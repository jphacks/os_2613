import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import { defaultPreferences, fontOptions, fontSizes, lineHeights, type DisplayPreferences } from './preferences.mjs';

export function paperColors(paper: DisplayPreferences['paper']) {
  return { background: paper === 'dark' ? colors.ink : paper === 'cream' ? colors.paper : paper === 'gray' ? colors.line : colors.surface,
    ink: paper === 'dark' ? colors.surface : colors.ink, muted: paper === 'dark' ? colors.line : colors.muted,
    accent: paper === 'dark' ? colors.wood : colors.accent, chosen: paper === 'dark' ? colors.accent : colors.line };
}
export function DisplaySettings({ value, close, apply, onPreview }: { onPreview?: (value: DisplayPreferences) => void; value: DisplayPreferences; close: () => void; apply: (value: DisplayPreferences) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value);
  const original = useRef(value);
  useEffect(() => { onPreview?.(draft); }, [draft, onPreview]);
  function cancel() { onPreview?.(original.current); close(); }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function option(label: string, active: boolean, press: () => void) {
    return <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: active, disabled: saving }} disabled={saving} onPress={press} style={[styles.option, active && styles.selected]}><Text style={{ color: active ? colors.surface : colors.accent }}>{label}</Text></Pressable>;
  }
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) cancel(); }}><View style={styles.overlay}><View style={styles.sheet}>
    <Text style={styles.title}>表示の設定</Text><ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>文字サイズ</Text><View style={styles.row}>{fontSizes.map(size => option(`${size}`, draft.fontSize === size, () => setDraft({ ...draft, fontSize: size })))}</View>
      <Text style={styles.label}>書体</Text><View style={styles.row}>{fontOptions.map(([font, label]) => option(label, draft.font === font, () => setDraft({ ...draft, font })))}</View>
      <Text style={{ color: colors.muted, fontSize: 11 }}>端末にない書体は近いフォントで表示します。</Text>
      <Text style={styles.label}>行間</Text><View style={styles.row}>{lineHeights.map((lineHeight, index) => option(['せまい', 'ややせまい', '標準', 'やや広い', '広い'][index], draft.lineHeight === lineHeight, () => setDraft({ ...draft, lineHeight })))}</View>
      <Text style={styles.label}>紙の色</Text><View style={styles.row}>{([['light', '明るい紙'], ['cream', '生成り'], ['gray', 'グレー'], ['dark', '暗い紙']] as const).map(([paper, label]) => option(label, draft.paper === paper, () => setDraft({ ...draft, paper })))}</View>
      <View style={styles.row}>{option('標準に戻す', false, () => setDraft({ ...defaultPreferences }))}{option('キャンセル', false, cancel)}
        <Pressable accessibilityRole="button" disabled={saving} style={[styles.option, styles.selected]} onPress={() => { setSaving(true); setError(''); void apply(draft).then(ok => { if (ok) close(); else setError('設定を保存できません。端末の空き容量や保存設定を確認して、もう一度お試しください。'); }).finally(() => setSaving(false)); }}><Text style={{ color: colors.surface }}>{saving ? '保存しています…' : '適用する'}</Text></Pressable>
      </View>
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.ink }}>{error}</Text>}
    </ScrollView></View></View></Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 64, paddingRight: 10, backgroundColor: 'transparent' }, sheet: { width: '82%', maxWidth: 310, maxHeight: '84%', alignSelf: 'flex-end', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  title: { padding: 12, color: colors.ink, fontSize: 21 }, content: { padding: 12, gap: 10 }, label: { fontSize: 16, color: colors.ink }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.surface }, selected: { backgroundColor: colors.accent }, sample: { padding: 14, borderRadius: 8 },
});
