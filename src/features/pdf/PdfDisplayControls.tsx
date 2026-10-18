import { ReaderPanel, usePhoneReaderPanel } from '@/shared/ReaderPanel';
import { StudyToolsContext, StudyToolPanel } from '@/features/study/StudyToolPanel';
import { AppIcon } from '@/shared/AppIcon';
import { useContext, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import { Slider } from '@/features/reader/DisplaySettings';
import { readerPanelHeader, readerPanelTitle, readerToolButton } from '@/features/reader/toolStyles';

type Props = { zoom: number; spread: boolean; onZoom: (zoom: number) => void; onSpread: (spread: boolean) => void };

export function PdfDisplayControls({ zoom, spread, onZoom, onSpread }: Props) {
  const phone = usePhoneReaderPanel();
  const tools = useContext(StudyToolsContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = tools ? tools.active === 'display' : localOpen;
  const setOpen = (value: boolean) => tools ? tools.select(value ? 'display' : null) : setLocalOpen(value);
  const content = <>
    <View style={readerPanelHeader}><Text style={readerPanelTitle}>表示</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="PDF表示をリセット" onPress={() => { onZoom(1); onSpread(!phone); }} style={styles.reset}><AppIcon name="refresh" size={22} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View><Text style={styles.label}>ページの表示</Text><View accessibilityRole="tablist" style={styles.tabs}>
        {[{ value: false, label: '1ページ' }, { value: true, label: '見開き' }].map(item => <Pressable key={item.label} accessibilityRole="tab" accessibilityState={{ selected: spread === item.value }} onPress={() => onSpread(item.value)} style={[styles.tab, spread === item.value && styles.selected]}><Text style={[styles.tabText, spread === item.value && styles.selectedText]}>{item.label}</Text></Pressable>)}
      </View></View>
      <View style={styles.row}><Text style={styles.label}>拡大</Text><View style={{ flex: 1 }}><Slider value={zoom} min={.5} max={3} step={.05} format={value => `${Math.round(value * 100)}%`} onChange={onZoom} /></View></View>
      <Pressable accessibilityRole="button" onPress={() => onZoom(1)} style={styles.fit}><AppIcon name="zoom_in" size={20} /><Text style={styles.tabText}>ページ全体を表示</Text></Pressable>
    </ScrollView>
  </>;
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="PDFの表示設定" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={readerToolButton}><Text style={styles.aa}>Aa</Text></Pressable>
    <ReaderPanel visible={open} label="表示" onClose={() => setOpen(false)} desktop={<StudyToolPanel visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.host}><Pressable accessibilityRole="button" accessibilityLabel="表示設定を閉じる" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} /><View accessibilityViewIsModal style={styles.panel}>{content}</View></View></StudyToolPanel>}>{content}</ReaderPanel>
  </View>;
}
const styles = StyleSheet.create({
  host: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 12 },
  panel: { width: 320, maxWidth: '94%', maxHeight: '70%', backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  content: { paddingHorizontal: 10, paddingVertical: 16, gap: 28 },
  reset: { marginLeft: 'auto', width: 40, height: 40, borderRadius: 20, backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center' },
  aa: { color: colors.accent, fontSize: 24, lineHeight: 28, fontWeight: '600' },
  label: { color: colors.ink, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 3, backgroundColor: colors.button, marginTop: 12 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 999 },
  selected: { backgroundColor: colors.accent }, tabText: { fontSize: 14, color: colors.ink }, selectedText: { color: colors.surface },
  fit: { flexDirection: 'row', gap: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.button },
});
