import { BookSelection } from '@/shared/BookSelection';
import { Redirect, Tabs } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ColorValue } from 'react-native';
import { useAccount } from '@/features/account/AccountProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/shared/theme';
function TabIcon({ type, color }: { type: 'timeline' | 'shelf' | 'profile'; color: ColorValue | undefined }) {
  if (type === 'shelf') return <View style={s.books}>{[21, 28, 24].map((height, i) => <View key={i} style={{ width: 6, height, borderWidth: 1.8, borderColor: color, borderRadius: 1.5 }} />)}</View>;
  if (type === 'profile') return <View style={s.icon}><View style={{ width: 10, height: 10, borderWidth: 1.8, borderColor: color, borderRadius: 5 }} /><View style={{ width: 23, height: 12, borderWidth: 1.8, borderColor: color, borderTopLeftRadius: 12, borderTopRightRadius: 12, marginTop: 3 }} /></View>;
  return <View style={[s.icon, { gap: 5 }]}>{[27, 21, 27].map((width, i) => <View key={i} style={{ width, height: 2.5, borderRadius: 1.25, backgroundColor: color }} />)}</View>;
}
export const unstable_settings = { initialRouteName: 'shelf' };
export default function MainTabs() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const insets = useSafeAreaInsets();
  const { identity, prefs, ready } = useAccount();
  if (ready && identity && !prefs.nameChosen) return <Redirect href="/settings" />;
  return <View style={{ flex: 1 }}>
    {desktop && <View style={s.band}>
      <Image source={require('../../../assets/images/dopabooks-mark-white.png')} accessibilityLabel="白いドパBOOKs シンボルマーク" resizeMode="contain" style={s.brandMark} />
      <Image source={require('../../../assets/images/dopabooks-wordmark.png')} accessibilityLabel="ドパBOOKS" resizeMode="contain" style={s.brandWordmark} />
    </View>}
    <Tabs tabBar={desktop ? ({ state, navigateToTab }) => <View style={s.sidebar}>
      {['profile', 'shelf', 'timeline'].map(name => {
        const route = state.routes.find(item => item.name === name);
        if (!route) return null;
        const active = state.routes[state.index].key === route.key;
        const label = name === 'profile' ? 'プロフィール' : name === 'shelf' ? '本棚' : 'タイムライン';
        return <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { navigateToTab(route.key); }} style={s.menuItem}>{active && <BookSelection />}<TabIcon type={name === 'shelf' ? 'shelf' : name as 'profile' | 'timeline'} color={active ? colors.accent : colors.muted} /><Text style={[s.menuLabel, active && { color: colors.accent, fontWeight: '600' }]}>{label}</Text></Pressable>;
      })}
    </View> : undefined} backBehavior="history" screenOptions={{ headerShown: false, tabBarPosition: desktop ? 'left' : 'bottom', tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 78 + Math.max(insets.bottom, 10), paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10) }, tabBarLabelStyle: { fontSize: 11, marginTop: 3 }, tabBarItemStyle: { maxWidth: 180 }, tabBarShowLabel: true }}>
    <Tabs.Screen name="timeline" options={{ title: 'タイムライン', tabBarIcon: ({ color }) => <TabIcon type="timeline" color={color ?? colors.muted} /> }} />
    <Tabs.Screen name="shelf" options={{ title: '本棚', tabBarIcon: ({ color }) => <TabIcon type="shelf" color={color ?? colors.muted} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'プロフィール', tabBarIcon: ({ color }) => <TabIcon type="profile" color={color ?? colors.muted} /> }} />
  </Tabs></View>;
}
const s = StyleSheet.create({ band: { height: 68, backgroundColor: colors.accent, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, brandMark: { width: 56, height: 42 }, brandWordmark: { width: 160, height: 28 }, brand: { color: colors.surface, fontSize: 20, fontWeight: '600' }, user: { color: colors.surface, fontSize: 16 }, sidebar: { width: 220, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.line, padding: 16, paddingTop: 24, gap: 10 }, menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16, borderRadius: 13, overflow: 'hidden', outlineWidth: 0 }, menuActive: { backgroundColor: colors.paper }, menuLabel: { color: colors.muted, fontSize: 14 }, icon: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' }, books: { width: 34, height: 32, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, paddingBottom: 1 } });
