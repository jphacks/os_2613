import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/features/account/AccountProvider';
import SettingsScreen from '@/features/account/SettingsScreen';
import StatsScreen from '@/features/stats/StatsScreen';
import { Chips } from '@/shared/Chips';
import { colors } from '@/shared/theme';
export default function ProfileScreen() {
  const { identity, prefs } = useAccount();
  const [view, setView] = useState('stats');
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.header}><Text style={s.eyebrow}>MY READING LIFE</Text><Text style={s.name}>{prefs.name}</Text><Text style={s.handle}>{identity ? `@${identity.handle}` : 'ゲストで読書中'}</Text>
      <View style={s.switcher}><Chips variant="segment" items={[{ id: 'stats', label: '読書の記録' }, { id: 'settings', label: '設定' }]} value={view} onChange={setView} /></View>
    </View>
    <View style={s.content}>{view === 'stats' ? <StatsScreen /> : <SettingsScreen embedded />}</View>
  </SafeAreaView>;
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.paper }, header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, width: '100%', maxWidth: 1000, alignSelf: 'center' }, eyebrow: { color: colors.accent, fontSize: 10, letterSpacing: 1.8 }, name: { color: colors.ink, fontSize: 30, fontWeight: '600', marginTop: 10 }, handle: { color: colors.muted, fontSize: 12, marginTop: 5 }, switcher: { maxWidth: 360, marginTop: 20 }, content: { flex: 1 } });
