import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';
import { useLibrary } from '@/features/library/LibraryProvider';

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { books, ready } = useLibrary();
  const book = books.find(item => item.id === id);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        {!ready ? <Text style={styles.note}>本を読み込んでいます…</Text> : !book ? <Text style={styles.note}>本が見つかりません。本棚に戻って追加してください。</Text> : <>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.note}>{book.author}</Text>
          <Text style={styles.note}>本文プレビュー</Text>
          <Text style={styles.text}>{book.text.slice(0, 4000)}{book.text.length > 4000 ? '\n\n…続きは青空文庫で確認できます。' : ''}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(book.cardUrl)}><Text style={styles.source}>出典：青空文庫の図書カードを開く</Text></Pressable>
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  page: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 22, color: colors.ink, marginBottom: 12 },
  note: { fontSize: 14, color: colors.muted },
  content: { padding: 24, gap: 12 },
  text: { fontSize: 16, lineHeight: 30, color: colors.ink, marginVertical: 12 },
  source: { color: colors.accent, fontSize: 14, lineHeight: 24 },
});
