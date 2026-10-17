import { NavigationButton } from '@/shared/NavigationButton';
import { OAuthReturn } from '@/features/account/OAuthReturn';
import { hasOAuthCallback } from '@/features/account/oauth';
import { AccountProvider } from '@/features/account/AccountProvider';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { LogBox, Platform, Text, View } from 'react-native';

import { colors } from '@/shared/theme';
import { LibraryProvider } from '@/features/library/LibraryProvider';

// 縦書きの紙面やPDF（DOMコンポーネント）を開いた瞬間に、Expo が準備前の内部ブラウザへ
// 表示内容を送ろうとして出る開発中だけのエラー。表示内容は別の経路で渡るので動作に影響はない。
LogBox.ignoreLogs([/Unable to find the 'DomWebView' view with tag/]);

export default function RootLayout() {
  const [authReturning, setAuthReturning] = useState(hasOAuthCallback);
  const finishAuth = useCallback(() => setAuthReturning(false), []);
  // SSRとブラウザーの最初の描画を揃えてから、画面幅に応じたナビゲーションを表示する。
  const [mounted, setMounted] = useState(Platform.OS !== 'web');
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accent }}>ドパBOOKs</Text></View>;

  if (authReturning) return <OAuthReturn done={finishAuth} />;

  return (
    <AccountProvider><LibraryProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerTitleAlign: 'center',
          headerLeft: () => <NavigationButton onPress={() => router.canGoBack() ? router.back() : router.dismissTo('/shelf')} />,
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink },
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        {/* 本棚は帯と見出しを画面の中で描くので、標準のヘッダーは出さない */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* 本の中ではスワイプでページをめくるので、スワイプで本棚へ戻る操作は切る（戻るのは左上のボタンだけ） */}
        <Stack.Screen name="book/[id]" options={{ title: '', gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <Stack.Screen name="settings" options={{ title: '設定' }} />
        <Stack.Screen name="stats" options={{ title: '読書の記録' }} />
        <Stack.Screen name="focus" options={{ title: '読書集中モード' }} />
        {/* 本を追加は画面を切り替えず、本棚の上に重ねて出す */}
        <Stack.Screen
          name="add"
          options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack>
    </LibraryProvider></AccountProvider>
  );
}
