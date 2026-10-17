import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/shared/theme';
import { LibraryProvider } from '@/features/library/LibraryProvider';

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
        <Stack.Screen name="book/[id]" options={{ title: '' }} />
        {/* 本を追加は画面を切り替えず、本棚の上に重ねて出す */}
        <Stack.Screen
          name="add"
          options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack>
    </LibraryProvider>
  );
}
