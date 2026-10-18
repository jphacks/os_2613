import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';
type Item = { id: string; label: string; description?: string; fontFamily?: string };

/** 中央1件と、その前後を薄く見せる縦選択。停止した候補だけを確定する。 */
export function VerticalCarousel({ items, value, onChange, label, compact = false }: { items: Item[]; value?: string | null; onChange: (id: string) => void; label: string; compact?: boolean }) {
  const rowHeight = compact ? 24 : 48, padding = compact ? 15 : 30;
  const initial = Math.max(0, items.findIndex(item => item.id === value));
  const [center, setCenter] = useState(initial);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false), momentum = useRef(false), currentIndex = useRef(initial);
  const last = useRef(items[initial]?.id), latest = useRef({ items, onChange }); latest.current = { items, onChange };
  const commit = (index: number, force = false) => {
    if (timer.current) clearTimeout(timer.current);
    const item = latest.current.items[index];
    if (item && (force || last.current !== item.id)) { last.current = item.id; latest.current.onChange(item.id); }
  };
  useEffect(() => {
    const index = Math.max(0, items.findIndex(item => item.id === value));
    last.current = items[index]?.id; setCenter(index);
    const frame = requestAnimationFrame(() => { if (!dragging.current && !momentum.current) scroll.current?.scrollTo({ y: index * rowHeight, animated: false }); });
    return () => cancelAnimationFrame(frame);
  }, [value, items.map(item => item.id).join('|')]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <View style={[s.frame, { height: rowHeight + padding * 2 }]}>
    <View pointerEvents="none" style={[s.selection, { top: padding, height: rowHeight }]} />
    <ScrollView ref={scroll} nestedScrollEnabled bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} snapToOffsets={items.map((_, index) => index * rowHeight)} snapToStart snapToEnd decelerationRate="fast" scrollEventThrottle={16} contentContainerStyle={{ paddingVertical: padding }}
      onScroll={event => {
        const index = Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.y / rowHeight)));
        currentIndex.current = index; setCenter(index);
        if (!dragging.current && !momentum.current) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => commit(index), 160); }
      }}
      onScrollBeginDrag={() => { dragging.current = true; if (timer.current) clearTimeout(timer.current); }}
      onScrollEndDrag={() => { dragging.current = false; timer.current = setTimeout(() => commit(currentIndex.current), 180); }}
      onMomentumScrollBegin={() => { momentum.current = true; if (timer.current) clearTimeout(timer.current); }}
      onMomentumScrollEnd={() => { momentum.current = false; commit(currentIndex.current); }}>
      {items.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${label}：${item.label}`} accessibilityState={{ selected: index === center }} onPress={() => { scroll.current?.scrollTo({ y: index * rowHeight, animated: false }); setCenter(index); commit(index, true); }} style={[s.row, { height: rowHeight, opacity: index === center ? 1 : .3 }]}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={[s.title, { fontFamily: item.fontFamily }, index === center && { fontWeight: '700' }]}>{item.label}</Text>
        {!!item.description && <Text numberOfLines={1} ellipsizeMode="tail" style={s.description}>{item.description}</Text>}
      </Pressable>)}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({ frame: { height: 108, overflow: 'hidden', borderRadius: 12 }, selection: { position: 'absolute', top: 30, height: 48, left: 0, right: 0, backgroundColor: colors.button, borderRadius: 10 }, row: { height: 48, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' }, title: { color: colors.ink, fontSize: 15, maxWidth: '100%' }, description: { color: colors.muted, fontSize: 11, maxWidth: '100%' } });
