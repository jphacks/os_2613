import { AppIcon } from '@/shared/AppIcon';
import { readerPanelTitle, readerPanelHeader } from './toolStyles';
import { VerticalCarousel } from '@/shared/VerticalCarousel';
import { ReaderPanel, usePhoneReaderPanel } from '@/shared/ReaderPanel';
import { StudyToolPanel } from '@/features/study/StudyToolPanel';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import { defaultPreferences, fontFamilies, fontOptions, fontSizeRange, lineHeightRange, type DisplayPreferences } from './preferences.mjs';

// 表示の設定：文字サイズ・行間は調節バー、書体は折りたたみの一覧、紙の色・文字の色は色の表で選ぶ。
// 変更はその場で紙面へ反映し、シートを閉じる時にまとめて保存する。

// 紙面の色。色の表で選んだ色があればそれを使い、無ければ以前の4種類（明るい紙・生成り・グレー・暗い紙）から決める
export function paperColors(display: DisplayPreferences | DisplayPreferences['paper']) {
  const value = typeof display === 'string' ? { paper: display } as DisplayPreferences : display;
  const paper = value.paper;
  const base = {
    background: paper === 'dark' ? colors.ink : paper === 'cream' ? colors.paper : paper === 'gray' ? colors.line : colors.surface,
    ink: paper === 'dark' ? colors.surface : colors.ink, muted: paper === 'dark' ? colors.line : colors.muted,
    accent: paper === 'dark' ? colors.wood : colors.accent, chosen: paper === 'dark' ? colors.accent : colors.line,
  };
  if (!value.paperColor && !value.inkColor) return base;
  const background = value.paperColor ?? base.background;
  const darkPaper = luminance(background) < 0.45;
  const ink = value.inkColor ?? (darkPaper ? colors.surface : colors.ink);
  return { background, ink, muted: mix(ink, background, 0.45), accent: darkPaper ? colors.wood : colors.accent, chosen: mix(ink, background, 0.82) };
}

// 色の計算（16進 → 明るさ、2色を混ぜる、色相・彩度・明度 → 16進）
const toRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => '#' + rgb.map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('').toUpperCase();
function luminance(hex: string) { const [r, g, b] = toRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function mix(a: string, b: string, t: number) { const x = toRgb(a), y = toRgb(b); return toHex(x.map((n, i) => n * (1 - t) + y[i] * t)); }
function hsl(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

// 色の表：横が色相（12色）、縦が明るさ。いちばん下の段は白〜黒の灰色
const HUES = Array.from({ length: 12 }, (_, i) => i * 30);
const LIGHTS = [0.92, 0.82, 0.68, 0.52, 0.38, 0.24];
const grid = [...LIGHTS.map(l => HUES.map(h => hsl(h, l > 0.85 ? 0.55 : 0.5, l))), Array.from({ length: 12 }, (_, i) => hsl(0, 0, 1 - i / 11))];

function ColorGrid({ value, onChange }: { value?: string; onChange: (hex: string) => void }) {
  return <View style={styles.grid}>
    {grid.map((row, r) => <View key={r} style={styles.gridRow}>
      {row.map(hex => <Pressable key={hex + r} accessibilityRole="button" accessibilityLabel={`色 ${hex}`} accessibilityState={{ selected: value === hex }} onPress={() => onChange(hex)}
        style={[styles.cell, { backgroundColor: hex }, value === hex && styles.cellSelected]} />)}
    </View>)}
  </View>;
}

// 調節バー（つまみを左右に動かして値を変える）
export function Slider({ value, min, max, step, onChange, format, showValue = true }: { value: number; min: number; max: number; step: number; onChange: (n: number) => void; format: (n: number) => string; showValue?: boolean }) {
  const width = useRef(0);
  const set = (x: number) => {
    const raw = min + Math.max(0, Math.min(1, x / Math.max(1, width.current))) * (max - min);
    onChange(Math.round(Math.round(raw / step) * step * 10) / 10);
  };
  const ratio = (value - min) / (max - min);
  return <View style={styles.sliderRow}>
    <View accessibilityRole="adjustable" accessibilityValue={{ min, max, now: value, text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => onChange(Math.round(Math.max(min, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? step : -step))) * 10) / 10)}
      onLayout={e => { width.current = e.nativeEvent.layout.width; }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={e => set(e.nativeEvent.locationX)} onResponderMove={e => set(e.nativeEvent.locationX)}
      style={styles.sliderTouch}>
      <View pointerEvents="none" style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${ratio * 100}%` }]} /></View>
      <View pointerEvents="none" style={[styles.sliderThumb, { left: `${ratio * 100}%` }]} />
    </View>
    {showValue && <Text style={styles.sliderValue}>{format(value)}</Text>}
  </View>;
}

export function DisplaySettings({ value, close, apply, onPreview }: { onPreview?: (value: DisplayPreferences) => void; value: DisplayPreferences; close: () => void; apply: (value: DisplayPreferences) => Promise<boolean> }) {
  const phoneSheet = usePhoneReaderPanel();
  const [draft, setDraft] = useState(value);
  const [colorTarget, setColorTarget] = useState<'paper' | 'ink'>('paper');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { onPreview?.(draft); }, [draft, onPreview]);
  function back() {
    if (saving) return;
    setSaving(true); setError('');
    void apply(draft).then(ok => { if (ok) close(); else setError('設定を保存できません。端末の空き容量や保存設定を確認して、もう一度閉じてください。'); }).finally(() => setSaving(false));
  }
  const paint = paperColors(draft);
  const selectedColor = colorTarget === 'paper' ? paint.background : paint.ink;
  const setColor = (hex: string) => setDraft(before => ({ ...before, [colorTarget === 'paper' ? 'paperColor' : 'inkColor']: hex }));

  const panelContent = <>
    <View style={readerPanelHeader}>
      <Text style={readerPanelTitle}>表示</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="表示設定をリセット" disabled={saving} onPress={() => setDraft({ ...defaultPreferences })} style={styles.resetIcon}><AppIcon name="refresh" size={22} /></Pressable>

    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.settingRow}><Text style={styles.settingLabel}>書体</Text><View style={{ flex: 1 }}><VerticalCarousel compact label="書体" value={draft.font} onChange={font => { const option = fontOptions.find(([id]) => id === font); if (option) setDraft(before => ({ ...before, font: option[0] })); }} items={fontOptions.map(([id, label]) => ({ id, label, fontFamily: fontFamilies[id] }))} /></View></View>
      <View style={styles.settingRow}><Text style={styles.settingLabel}>文字</Text><View style={{ flex: 1 }}><Slider value={draft.fontSize} {...fontSizeRange} format={n => `${n}`} onChange={fontSize => setDraft({ ...draft, fontSize })} /></View></View>
      <View style={styles.settingRow}><Text style={styles.settingLabel}>行間</Text><View style={{ flex: 1 }}><Slider value={draft.lineHeight} {...lineHeightRange} format={n => n.toFixed(1)} onChange={lineHeight => setDraft({ ...draft, lineHeight })} /></View></View>



      <View style={styles.colorHeader}>
        <View accessibilityRole="tablist" style={styles.colorTabs}>{([{ id: 'paper', label: '紙の色', value: paint.background }, { id: 'ink', label: '文字の色', value: paint.ink }] as const).map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: colorTarget === item.id }} onPress={() => setColorTarget(item.id)} style={[styles.colorTab, colorTarget === item.id && styles.colorTabSelected]}><View style={[styles.swatch, { backgroundColor: item.value }]} /><Text style={styles.label}>{item.label}</Text></Pressable>)}</View>
      </View>
      <ColorGrid value={selectedColor} onChange={setColor} />

      {!!error && <Text accessibilityRole="alert" style={{ color: colors.ink }}>{error}</Text>}
    </ScrollView>

</>;
  return <ReaderPanel visible label="表示設定" onClose={back} desktop={<StudyToolPanel visible transparent animationType="slide" onRequestClose={back}><View style={styles.overlay}><View style={styles.sheet}>{panelContent}</View></View></StudyToolPanel>}>{panelContent}</ReaderPanel>;

}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 64, paddingRight: 10, backgroundColor: 'transparent' },
  sheet: { width: '86%', maxWidth: 300, maxHeight: '70%', alignSelf: 'flex-end', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 2 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.accent, fontSize: 28, lineHeight: 30 },
  title: { color: colors.ink, fontSize: 16 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 12, paddingBottom: 3, gap: 12 },
  sample: { borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 12 },
  label: { fontSize: 13, color: colors.ink },
  note: { color: colors.muted, fontSize: 11, paddingTop: 4 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderTouch: { flex: 1, height: 32, justifyContent: 'center' },
  sliderTrack: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  sliderFill: { height: 5, backgroundColor: colors.accent },
  sliderThumb: { position: 'absolute', top: 7, width: 18, height: 18, borderRadius: 9, marginLeft: -9, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent },
  sliderValue: { width: 36, textAlign: 'right', color: colors.ink, fontVariant: ['tabular-nums'] },
  fold: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.button, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  foldValue: { flex: 1, textAlign: 'right', color: colors.accent, fontSize: 13 },
  chevron: { color: colors.muted, fontSize: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, settingLabel: { width: 66, color: colors.ink, fontSize: 13 },
  colorHeader: { flexDirection: 'row', gap: 8, alignItems: 'center' }, colorTabs: { flex: 1, flexDirection: 'row', borderRadius: 999, padding: 3, backgroundColor: colors.button },
  colorTab: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 7, justifyContent: 'center', alignItems: 'center', borderRadius: 999 }, colorTabSelected: { backgroundColor: colors.surface },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.line }, paletteButton: { padding: 8, borderRadius: 8, backgroundColor: colors.button },
  quickColors: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 4 }, quickCell: { flex: 1, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.line }, quickSelected: { borderWidth: 3, borderColor: colors.accent },
  fontList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 3 },
  fontRow: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.button }, fontSelected: { backgroundColor: colors.accent },
  fontName: { color: colors.ink, fontSize: 13 },
  check: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  grid: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  gridRow: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1 },
  cellSelected: { borderWidth: 2.5, borderColor: colors.surface, transform: [{ scale: 1.15 }], zIndex: 2, borderRadius: 3 },
  resetIcon: { marginLeft: 'auto', width: 40, height: 40, borderRadius: 20, backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center' },
  headerAction: { flex: 0, minWidth: 64, paddingHorizontal: 12, paddingVertical: 8 },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingTop: 3, paddingBottom: 8, borderTopWidth: 1, borderColor: colors.line },
  button: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  reset: { backgroundColor: colors.button },
  resetText: { color: colors.accent },
  save: { backgroundColor: colors.accent },
  saveText: { color: colors.surface, fontWeight: '700' },
});
