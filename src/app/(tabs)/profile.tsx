import { Avatar } from '@/shared/Avatar';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/features/account/AccountProvider';
import StatsScreen from '@/features/stats/StatsScreen';
import { SettingsGlyph } from '@/shared/SettingsGlyph';
import { colors } from '@/shared/theme';
export default function ProfileScreen() {
  const { identity, prefs } = useAccount();
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.header}>
      <Avatar uri={identity?.avatar} size={60} /><View style={[s.identity, { marginLeft: 16 }]}><Text style={s.name}>{prefs.name}</Text><Text style={s.handle}>{identity ? `@${identity.handle}` : 'ゲストで読書中'}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="設定を開く" onPress={() => router.push('/settings')} style={({ pressed }) => [s.settings, pressed && { opacity: 0.55 }]}><SettingsGlyph /></Pressable>
    </View>
    <View style={s.content}><StatsScreen /></View>
  </SafeAreaView>;
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.paper }, header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, width: '100%', maxWidth: 1000, alignSelf: 'center' }, identity: { flex: 1 }, settings: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 2 }, eyebrow: { color: colors.accent, fontSize: 10, letterSpacing: 1.8 }, name: { color: colors.ink, fontSize: 30, fontWeight: '600', marginTop: 10 }, handle: { color: colors.muted, fontSize: 12, marginTop: 5 }, content: { flex: 1 } });
