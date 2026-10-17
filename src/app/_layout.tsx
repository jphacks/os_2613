import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/shared/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink },
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" options={{ title: '本棚' }} />
        <Stack.Screen name="book/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}
