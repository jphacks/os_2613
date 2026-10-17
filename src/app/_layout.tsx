import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';

import { colors } from '@/shared/theme';
import { LibraryProvider } from '@/features/library/LibraryProvider';

// 縦書きの紙面やPDF（DOMコンポーネント）を開いた瞬間に、Expo が準備前の内部ブラウザへ
// 表示内容を送ろうとして出る開発中だけのエラー。表示内容は別の経路で渡るので動作に影響はない。
LogBox.ignoreLogs([/Unable to find the 'DomWebView' view with tag/]);

export default function RootLayout() {
  return (
    <LibraryProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink },
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        {/* 本棚は帯と見出しを画面の中で描くので、標準のヘッダーは出さない */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* 本の中ではスワイプでページをめくるので、スワイプで本棚へ戻る操作は切る（戻るのは左上のボタンだけ） */}
        <Stack.Screen name="book/[id]" options={{ title: '', gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <Stack.Screen name="stats" options={{ title: '読書の記録' }} />
        <Stack.Screen name="focus" options={{ title: '読書集中モード' }} />
        {/* 本を追加は画面を切り替えず、本棚の上に重ねて出す */}
        <Stack.Screen
          name="add"
          options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack>
    </LibraryProvider>
  );
}
