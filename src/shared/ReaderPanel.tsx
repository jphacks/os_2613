import { DesktopReaderPopover } from './DesktopReaderPopover';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';
import { sheetDestination, sheetHeights } from './reader-sheet.mjs';
export function usePhoneReaderPanel() {
  const { width, height } = useWindowDimensions();
  return Platform.OS === 'web' ? width < 768 : Platform.OS === 'ios' ? !Platform.isPad : Math.min(width, height) < 600;
}
/** ジェスチャーはつまみだけで受け、本文・スライダー・一覧の操作と競合させない。 */
export function ReaderPanel({ visible, onClose, children, desktop, label }: { visible: boolean; onClose: () => void; children: ReactNode; desktop: ReactNode; label: string }) {
  const mobile = usePhoneReaderPanel(), { height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const size = useRef(new Animated.Value(0)).current;
  const current = useRef(0), start = useRef(0), latest = useRef({ height, onClose }); latest.current = { height, onClose };
  const animate = (to: number, close = false) => Animated.timing(size, { toValue: to, duration: 200, useNativeDriver: false }).start(({ finished }) => { if (finished && close) latest.current.onClose(); });
  useEffect(() => { const listener = size.addListener(({ value }) => { current.current = value; }); return () => size.removeListener(listener); }, [size]);
  useEffect(() => { if (visible && mobile) { size.setValue(0); animate(sheetHeights(height).compact); } }, [visible, mobile, height]);
  const drag = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { size.stopAnimation(value => { start.current = value; }); },
    onPanResponderMove: (_, gesture) => size.setValue(Math.max(0, Math.min(sheetHeights(latest.current.height).full, start.current - gesture.dy))),
    onPanResponderRelease: (_, gesture) => { const target = sheetDestination(start.current, gesture.dy, gesture.vy, latest.current.height); animate(target, target === 0); },
    onPanResponderTerminate: () => animate(sheetHeights(latest.current.height).compact),
  })).current;
  if (!mobile && Platform.OS === 'web' && label !== 'しおり') return <DesktopReaderPopover visible={visible} label={label} onClose={onClose}>{children}</DesktopReaderPopover>;
  if (!mobile) return <>{desktop}</>;
  return <Modal visible={visible} transparent animationType="none" onRequestClose={() => animate(0, true)} statusBarTranslucent>
    <View style={s.host}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={`${label}を閉じる・本文に戻る`} onPress={() => animate(0, true)} />
      <Animated.View accessibilityViewIsModal style={[s.sheet, { height: size, paddingBottom: Math.max(8, insets.bottom) }]}>
        <View {...drag.panHandlers} style={s.handleTouch}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${label}の高さを切り替える`} accessibilityHint="つまみを上下にスワイプして拡大・縮小・閉じる" onPress={() => { const stops = sheetHeights(height); animate(current.current > (stops.compact + stops.full) / 2 ? stops.compact : stops.full); }} style={s.handleButton}><View style={s.handle} /></Pressable>
        </View>
        <View style={s.content}>{children}</View>
      </Animated.View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({ host: { flex: 1, justifyContent: 'flex-end' }, sheet: { width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', boxShadow: '0 -3px 16px rgba(41,46,41,0.14)' }, handleTouch: { height: 34, flexShrink: 0 }, handleButton: { flex: 1, alignItems: 'center', justifyContent: 'center' }, handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.muted }, content: { flex: 1, minHeight: 0, paddingHorizontal: 12 } });
