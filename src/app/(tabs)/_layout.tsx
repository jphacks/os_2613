import { BookSelection } from '@/shared/BookSelection';
import { Redirect, Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ColorValue } from 'react-native';
import { useAccount } from '@/features/account/AccountProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/shared/theme';
function TabIcon({ type, color }: { type: 'timeline' | 'shelf' | 'profile'; color: ColorValue | undefined }) {
  if (type === 'shelf') return <View style={s.books}>{[16, 21, 18].map((height, i) => <View key={i} style={{ width: 5, height, borderWidth: 1.6, borderColor: color, borderRadius: 1 }} />)}</View>;
  if (type === 'profile') return <View style={s.icon}><View style={{ width: 8, height: 8, borderWidth: 1.6, borderColor: color, borderRadius: 4 }} /><View style={{ width: 18, height: 9, borderWidth: 1.6, borderColor: color, borderTopLeftRadius: 10, borderTopRightRadius: 10, marginTop: 3 }} /></View>;
  return <View style={[s.icon, { gap: 4 }]}>{[21, 16, 21].map((width, i) => <View key={i} style={{ width, height: 2, borderRadius: 1, backgroundColor: color }} />)}</View>;
}
export const unstable_settings = { initialRouteName: 'shelf' };
export default function MainTabs() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const insets = useSafeAreaInsets();
  const { identity, prefs, ready } = useAccount();
  if (ready && identity && !prefs.nameChosen) return <Redirect href="/settings" />;
  return <View style={{ flex: 1 }}>
    {desktop && <View style={s.band} />}
    <Tabs tabBar={desktop ? ({ state, navigateToTab }) => <View style={s.sidebar}>
      {['profile', 'shelf', 'timeline'].map(name => {
        const route = state.routes.find(item => item.name === name);
        if (!route) return null;
        const active = state.routes[state.index].key === route.key;
        const label = name === 'profile' ? 'プロフィール' : name === 'shelf' ? '本棚' : 'タイムライン';
        return <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { navigateToTab(route.key); }} style={s.menuItem}>{active && <BookSelection />}<TabIcon type={name === 'shelf' ? 'shelf' : name as 'profile' | 'timeline'} color={active ? colors.accent : colors.muted} /><Text style={[s.menuLabel, active && { color: colors.accent, fontWeight: '600' }]}>{label}</Text></Pressable>;
      })}
    </View> : undefined} backBehavior="history" screenOptions={{ headerShown: false, tabBarPosition: desktop ? 'left' : 'bottom', tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64 + Math.max(insets.bottom, 10), paddingTop: 9, paddingBottom: Math.max(insets.bottom, 10) }, tabBarLabelStyle: { fontSize: 11, marginTop: 3 }, tabBarItemStyle: { maxWidth: 180 }, tabBarShowLabel: true }}>
    <Tabs.Screen name="timeline" options={{ title: 'タイムライン', tabBarIcon: ({ color }) => <TabIcon type="timeline" color={color ?? colors.muted} /> }} />
    <Tabs.Screen name="shelf" options={{ title: '本棚', tabBarIcon: ({ color }) => <TabIcon type="shelf" color={color ?? colors.muted} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'プロフィール', tabBarIcon: ({ color }) => <TabIcon type="profile" color={color ?? colors.muted} /> }} />
  </Tabs></View>;
}
const s = StyleSheet.create({ band: { height: 64, backgroundColor: colors.accent, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: colors.surface, fontSize: 20, fontWeight: '600' }, user: { color: colors.surface, fontSize: 16 }, sidebar: { width: 220, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.line, padding: 16, paddingTop: 24, gap: 10 }, menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16, borderRadius: 999 }, menuActive: { backgroundColor: colors.paper }, menuLabel: { color: colors.muted, fontSize: 14 }, icon: { width: 26, height: 25, alignItems: 'center', justifyContent: 'center' }, books: { width: 26, height: 25, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, paddingBottom: 2 } });
