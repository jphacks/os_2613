import { StyleSheet, View } from 'react-native';
import { colors } from './theme';
// 背表紙と上下の表紙だけを緑にし、紙の小口は開いておく。
export function BookSelection() {
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.root}>
    <View style={s.cover} />
    <View style={s.paper} />
    <View style={[s.overhang, { top: 0 }]} /><View style={[s.overhang, { bottom: 0 }]} />
  </View>;
}
const s = StyleSheet.create({ root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, cover: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 4, backgroundColor: colors.accent, borderTopLeftRadius: 13, borderBottomLeftRadius: 13 }, paper: { position: 'absolute', left: 8, right: 4, top: 3, bottom: 3, backgroundColor: colors.paper, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }, overhang: { position: 'absolute', right: 0, width: 8, height: 3, backgroundColor: colors.accent, borderRadius: 1 }, edges: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, justifyContent: 'space-evenly' }, line: { height: 1, backgroundColor: colors.line } });
