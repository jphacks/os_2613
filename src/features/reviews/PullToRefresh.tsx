import { useRef, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, Pressable, useWindowDimensions, type ScrollViewProps } from 'react-native';
import { colors } from '@/shared/theme';

// Webにも同じ操作を用意し、一覧の先頭での下方向のドラッグだけを更新に使う。
export function PullToRefresh({ refreshing, onRefresh, children, ...props }: ScrollViewProps & { refreshing: boolean; onRefresh: () => void | Promise<void> }) {
  const top = useRef(true), start = useRef<{ x: number; y: number } | null>(null), distance = useRef(0);
  const [pull, setPull] = useState(0);
  const web = Platform.OS === 'web';
  const { width } = useWindowDimensions();
  return <ScrollView {...props} scrollEventThrottle={16}
    onScroll={event => { top.current = event.nativeEvent.contentOffset.y <= 0; props.onScroll?.(event); }}
    refreshControl={web ? undefined : <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} colors={[colors.accent]} />}
    onTouchStart={event => { const touch = event.nativeEvent.touches[0]; start.current = web && top.current && !refreshing && touch ? { x: touch.pageX, y: touch.pageY } : null; distance.current = 0; }}
    onTouchMove={event => { const touch = event.nativeEvent.touches[0], origin = start.current; if (!origin || !touch) return; const dy = touch.pageY - origin.y; if (!top.current || Math.abs(touch.pageX - origin.x) > Math.max(20, dy)) { start.current = null; distance.current = 0; setPull(0); return; } distance.current = Math.max(0, dy); setPull(Math.min(90, distance.current)); }}
    onTouchEnd={() => { const update = distance.current >= 72 && top.current && !refreshing; start.current = null; distance.current = 0; setPull(0); if (update) void onRefresh(); }}
    onTouchCancel={() => { start.current = null; distance.current = 0; setPull(0); }}>
    {web && width >= 768 && <Pressable accessibilityRole="button" accessibilityLabel="一覧を更新" disabled={refreshing} onPress={() => void onRefresh()} style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.button, borderRadius: 999, marginBottom: 8 }}><Text style={{ color: colors.accent }}>{refreshing ? '更新中…' : '更新'}</Text></Pressable>}
    {web && (pull > 0 || refreshing) && <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center', color: colors.muted, padding: 10 }}>{refreshing ? '更新中…' : pull >= 72 ? '離して更新' : '下に引っ張って更新'}</Text>}
    {children}
  </ScrollView>;
}
