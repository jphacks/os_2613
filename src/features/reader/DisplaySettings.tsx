import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import { defaultPreferences, fontFamilies, fontOptions, fontSizeRange, lineHeightRange, type DisplayPreferences } from './preferences.mjs';

// 表示の設定：文字サイズ・行間は調節バー、書体は折りたたみの一覧、紙の色・文字の色は色の表で選ぶ。
// 変えた内容はその場で紙面に映し（プレビュー）、「保存」で確定する。左上の戻るボタンは保存せずに閉じる。

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
function Slider({ value, min, max, step, onChange, format }: { value: number; min: number; max: number; step: number; onChange: (n: number) => void; format: (n: number) => string }) {
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
    <Text style={styles.sliderValue}>{format(value)}</Text>
  </View>;
}

export function DisplaySettings({ value, close, apply, onPreview }: { onPreview?: (value: DisplayPreferences) => void; value: DisplayPreferences; close: () => void; apply: (value: DisplayPreferences) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value);
  const original = useRef(value);
  const [fontsOpen, setFontsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { onPreview?.(draft); }, [draft, onPreview]);
  // 戻る：保存せずに、開く前の表示へ戻して閉じる
  function back() { if (saving) return; onPreview?.(original.current); close(); }
  function save() {
    setSaving(true); setError('');
    void apply(draft).then(ok => { if (ok) close(); else setError('設定を保存できません。端末の空き容量や保存設定を確認して、もう一度お試しください。'); }).finally(() => setSaving(false));
  }
  const fontLabel = fontOptions.find(([font]) => font === draft.font)?.[1] ?? '明朝';
  const paint = paperColors(draft);

  return <Modal visible transparent animationType="slide" onRequestClose={back}><View style={styles.overlay}><View style={styles.sheet}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="戻る" onPress={back} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
      <Text style={styles.title}>表示の設定</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {/* 見本：今の設定で文章がどう見えるか */}
      <View style={[styles.sample, { backgroundColor: paint.background }]}>
        <Text style={{ color: paint.ink, fontFamily: fontFamilies[draft.font], fontSize: Math.min(draft.fontSize, 26), lineHeight: Math.min(draft.fontSize, 26) * draft.lineHeight }}>メロスは激怒した。必ず、かの邪智暴虐の王を除かなければならぬと決意した。</Text>
      </View>

      <Text style={styles.label}>文字サイズ</Text>
      <Slider value={draft.fontSize} {...fontSizeRange} format={n => `${n}`} onChange={fontSize => setDraft({ ...draft, fontSize })} />

      <Text style={styles.label}>行間</Text>
      <Slider value={draft.lineHeight} {...lineHeightRange} format={n => n.toFixed(1)} onChange={lineHeight => setDraft({ ...draft, lineHeight })} />

      {/* 書体：押すと縦に一覧が開く。それぞれの書体で名前を表示する */}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: fontsOpen }} onPress={() => setFontsOpen(!fontsOpen)} style={styles.fold}>
        <Text style={styles.label}>書体</Text>
        <Text style={[styles.foldValue, { fontFamily: fontFamilies[draft.font] }]}>{fontLabel}</Text>
        <Text style={styles.chevron}>{fontsOpen ? '▴' : '▾'}</Text>
      </Pressable>
      {fontsOpen && <View style={styles.fontList}>
        {fontOptions.map(([font, label]) => <Pressable key={font} accessibilityRole="button" accessibilityState={{ selected: draft.font === font }} onPress={() => setDraft({ ...draft, font })} style={styles.fontRow}>
          <Text style={[styles.fontName, { fontFamily: fontFamilies[font] }]}>{label}</Text>
          {draft.font === font && <Text style={styles.check}>✓</Text>}
        </Pressable>)}
        <Text style={styles.note}>端末にない書体は近いフォントで表示します。</Text>
      </View>}

      <Text style={styles.label}>紙の色</Text>
      <ColorGrid value={draft.paperColor} onChange={paperColor => setDraft({ ...draft, paperColor })} />
      <Text style={styles.label}>文字の色</Text>
      <ColorGrid value={draft.inkColor} onChange={inkColor => setDraft({ ...draft, inkColor })} />

      {!!error && <Text accessibilityRole="alert" style={{ color: colors.ink }}>{error}</Text>}
    </ScrollView>
    <View style={styles.footer}>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => setDraft({ ...defaultPreferences })} style={[styles.button, styles.reset]}><Text style={styles.resetText}>リセット</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.button, styles.save]}><Text style={styles.saveText}>{saving ? '保存しています…' : '保存'}</Text></Pressable>
    </View>
  </View></View></Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 64, paddingRight: 10, backgroundColor: 'transparent' },
  sheet: { width: '86%', maxWidth: 330, maxHeight: '86%', alignSelf: 'flex-end', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.accent, fontSize: 28, lineHeight: 30 },
  title: { color: colors.ink, fontSize: 19 },
  content: { padding: 14, gap: 10 },
  sample: { borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 12 },
  label: { fontSize: 15, color: colors.ink },
  note: { color: colors.muted, fontSize: 11, paddingTop: 4 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderTouch: { flex: 1, height: 32, justifyContent: 'center' },
  sliderTrack: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  sliderFill: { height: 5, backgroundColor: colors.accent },
  sliderThumb: { position: 'absolute', top: 7, width: 18, height: 18, borderRadius: 9, marginLeft: -9, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent },
  sliderValue: { width: 36, textAlign: 'right', color: colors.ink, fontVariant: ['tabular-nums'] },
  fold: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  foldValue: { flex: 1, textAlign: 'right', color: colors.accent, fontSize: 15 },
  chevron: { color: colors.muted, fontSize: 14 },
  fontList: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden', marginTop: -4 },
  fontRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderColor: colors.line },
  fontName: { flex: 1, color: colors.ink, fontSize: 16 },
  check: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  grid: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  gridRow: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1 },
  cellSelected: { borderWidth: 2.5, borderColor: colors.surface, transform: [{ scale: 1.15 }], zIndex: 2, borderRadius: 3 },
  footer: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderColor: colors.line },
  button: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  reset: { borderWidth: 1, borderColor: colors.line },
  resetText: { color: colors.accent },
  save: { backgroundColor: colors.accent },
  saveText: { color: colors.surface, fontWeight: '700' },
});
