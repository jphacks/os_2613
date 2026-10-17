import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

// 本の画面。いまは中身を表示するだけで、読書の機能はまだない。
export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <View style={styles.page}>
        <Text style={styles.title}>走れメロス</Text>
        <Text style={styles.note}>本文はここに表示されます（{id}）</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  page: {
    flex: 1,
    padding: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 22, color: colors.ink, marginBottom: 12 },
  note: { fontSize: 14, color: colors.muted },
});
