import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/features/account/AccountProvider';
import { colors } from '@/shared/theme';
export default function TimelineScreen() {
  const { identity } = useAccount();
  return <SafeAreaView edges={['top']} style={s.screen}><ScrollView contentContainerStyle={s.body}>
    <Text style={s.eyebrow}>READING TOGETHER</Text><Text style={s.title}>タイムライン</Text>
    <View style={s.empty}><View style={s.symbol}><Text style={s.symbolText}>≋</Text></View><Text style={s.heading}>読書のつづきを、みんなと。</Text><Text style={s.note}>本の感想や読書の成果を共有する場所です。{identity ? '投稿の取得・共有機能は準備中です。' : 'Blueskyとつないで、読書の輪を広げましょう。投稿の取得・共有機能は準備中です。'}</Text>
      {!identity && <Pressable onPress={() => router.push('/settings')} style={s.button}><Text style={s.light}>Blueskyとつなぐ　↗</Text></Pressable>}
    </View>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.paper }, body: { padding: 24, width: '100%', maxWidth: 720, alignSelf: 'center' }, eyebrow: { color: colors.accent, fontSize: 10, letterSpacing: 1.8 }, title: { color: colors.ink, fontSize: 30, marginTop: 8 }, empty: { marginTop: 42, backgroundColor: colors.surface, paddingHorizontal: 28, paddingVertical: 42, borderRadius: 24, alignItems: 'center', gap: 18 }, symbol: { backgroundColor: colors.paper, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }, symbolText: { fontSize: 36, color: colors.accent }, heading: { color: colors.ink, fontSize: 19, textAlign: 'center' }, note: { color: colors.muted, fontSize: 13, lineHeight: 23, textAlign: 'center', maxWidth: 350 }, button: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 }, light: { color: colors.surface, fontSize: 13 } });
