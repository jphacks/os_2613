import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';
import { NavigationButton } from './NavigationButton';
export function PageHeader({ title, backLabel = '戻る', onBack }: { title: string; backLabel?: string; onBack: () => void }) {
  return <SafeAreaView edges={['top']} style={s.safe}><View style={s.row}><NavigationButton label={backLabel} onPress={onBack} /><Text accessibilityRole="header" style={s.title}>{title}</Text></View></SafeAreaView>;
}
const s = StyleSheet.create({ safe: { backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line }, row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 12, paddingVertical: 10 }, title: { fontSize: 21, fontWeight: '600', color: colors.ink, flex: 1, minWidth: 0 } });
