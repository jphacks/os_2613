import { ReaderPanel, usePhoneReaderPanel } from '@/shared/ReaderPanel';
import { StudyToolsContext, StudyToolPanel } from '@/features/study/StudyToolPanel';
import { AppIcon } from '@/shared/AppIcon';
import { useContext, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationButton } from '@/shared/NavigationButton';
import { colors } from '@/shared/theme';

type Props = { zoom: number; spread: boolean; onZoom: (zoom: number) => void; onSpread: (spread: boolean) => void };

export function PdfDisplayControls({ zoom, spread, onZoom, onSpread }: Props) {
  const phoneSheet = usePhoneReaderPanel();
  const tools = useContext(StudyToolsContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = tools ? tools.active === 'display' : localOpen;
  const setOpen = (value: boolean) => tools ? tools.select(value ? 'display' : null) : setLocalOpen(value);
  const [width, setWidth] = useState(1);
  const change = (value: number) => onZoom(Math.max(0.5, Math.min(3, Math.round(value * 20) / 20)));
  const button = (label: string, onPress: () => void, selected?: boolean) => <Pressable accessibilityRole="button" accessibilityState={selected === undefined ? undefined : { selected }} onPress={onPress} style={[styles.button, selected && styles.active]}><Text style={[styles.text, selected && styles.activeText]}>{label}</Text></Pressable>;
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="PDFの表示設定" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={styles.trigger}><Text style={{ color: colors.accent, fontSize: 20, fontWeight: '700' }}>Aa</Text></Pressable>
    <ReaderPanel visible={open} label="PDF表示設定" onClose={() => setOpen(false)} desktop={<StudyToolPanel visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.host}>
      <Pressable accessibilityRole="button" accessibilityLabel="表示設定を閉じる" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
      <View accessibilityViewIsModal style={styles.panel}>{!phoneSheet && <NavigationButton close label="閉じる" onPress={() => setOpen(false)} />}<View style={styles.row}>
    <View style={styles.zoomGroup}><AppIcon name="zoom_in" size={20} />
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
    {button('全体表示', () => onZoom(1))}</View>
    {button('1ページ', () => onSpread(false), !spread)}
    {button('見開き', () => onSpread(true), spread)}
  </View></View></View></StudyToolPanel>}><View style={{ gap: 12 }}>{!phoneSheet && <NavigationButton close label="閉じる" onPress={() => setOpen(false)} />}<View style={styles.row}>
    <View style={styles.zoomGroup}><AppIcon name="zoom_in" size={20} />
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
    {button('全体表示', () => onZoom(1))}</View>
    {button('1ページ', () => onSpread(false), !spread)}
    {button('見開き', () => onSpread(true), spread)}
  </View></View></ReaderPanel></View>;
}

const styles = StyleSheet.create({
  trigger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.button },
  host: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 12 },
  panel: { width: 320, maxWidth: '94%', padding: 16, gap: 18, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  zoomGroup: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.button },
  text: { fontSize: 12, color: colors.ink }, value: { width: 38, fontVariant: ['tabular-nums'] },
  button: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.button },
  active: { backgroundColor: colors.accent, borderColor: colors.accent }, activeText: { color: colors.surface },
  slider: { width: 130, height: 36, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' }, fill: { height: 5, backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 18, height: 18, borderRadius: 9, marginLeft: -9, top: 9, backgroundColor: colors.accent },
});
