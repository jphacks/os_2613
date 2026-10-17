import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import { defaultPreferences, fontSizes, lineHeights, type DisplayPreferences } from './preferences.mjs';

export function paperColors(paper: DisplayPreferences['paper']) {
  return { background: paper === 'dark' ? colors.ink : paper === 'cream' ? colors.paper : paper === 'gray' ? colors.line : colors.surface,
    ink: paper === 'dark' ? colors.surface : colors.ink, muted: paper === 'dark' ? colors.line : colors.muted,
    accent: paper === 'dark' ? colors.wood : colors.accent, chosen: paper === 'dark' ? colors.accent : colors.line };
}
export function DisplaySettings({ value, close, apply }: { value: DisplayPreferences; close: () => void; apply: (value: DisplayPreferences) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function option(label: string, active: boolean, press: () => void) {
    return <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: active, disabled: saving }} disabled={saving} onPress={press} style={[styles.option, active && styles.selected]}><Text style={{ color: active ? colors.surface : colors.accent }}>{label}</Text></Pressable>;
  }
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) close(); }}><View style={styles.overlay}><View style={styles.sheet}>
    <Text style={styles.title}>表示の設定</Text><ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>文字サイズ</Text><View style={styles.row}>{fontSizes.map(size => option(`${size}`, draft.fontSize === size, () => setDraft({ ...draft, fontSize: size })))}</View>
      <Text style={styles.label}>書体</Text><View style={styles.row}>{([['mincho', '明朝'], ['gothic', 'ゴシック'], ['rounded', '丸ゴシック']] as const).map(([font, label]) => option(label, draft.font === font, () => setDraft({ ...draft, font })))}</View>
      <Text style={styles.label}>行間</Text><View style={styles.row}>{lineHeights.map((lineHeight, index) => option(['せまい', 'ややせまい', '標準', 'やや広い', '広い'][index], draft.lineHeight === lineHeight, () => setDraft({ ...draft, lineHeight })))}</View>
      <Text style={styles.label}>紙の色</Text><View style={styles.row}>{([['light', '明るい紙'], ['cream', '生成り'], ['gray', 'グレー'], ['dark', '暗い紙']] as const).map(([paper, label]) => option(label, draft.paper === paper, () => setDraft({ ...draft, paper })))}</View>
      <View style={[styles.sample, { backgroundColor: paperColors(draft.paper).background }]}><Text style={{ color: paperColors(draft.paper).ink, fontSize: draft.fontSize, lineHeight: draft.fontSize * draft.lineHeight }}>物語を、あなたの読みやすいかたちで。</Text></View>
      <View style={styles.row}>{option('標準に戻す', false, () => setDraft({ ...defaultPreferences }))}{option('キャンセル', false, close)}
        <Pressable accessibilityRole="button" disabled={saving} style={[styles.option, styles.selected]} onPress={() => { setSaving(true); setError(''); void apply(draft).then(ok => { if (ok) close(); else setError('設定を保存できません。端末の空き容量や保存設定を確認して、もう一度お試しください。'); }).finally(() => setSaving(false)); }}><Text style={{ color: colors.surface }}>{saving ? '保存しています…' : '適用する'}</Text></Pressable>
      </View>
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.ink }}>{error}</Text>}
    </ScrollView></View></View></Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: colors.paper, padding: 16 }, sheet: { width: '100%', maxWidth: 640, maxHeight: '92%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  title: { padding: 18, color: colors.ink, fontSize: 21 }, content: { padding: 18, gap: 14 }, label: { fontSize: 16, color: colors.ink }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.surface }, selected: { backgroundColor: colors.accent }, sample: { padding: 14, borderRadius: 8 },
});
