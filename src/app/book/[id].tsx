import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';
import { useLibrary } from '@/features/library/LibraryProvider';
import { BookReading } from '@/features/bookmark/BookReading';

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { books, ready } = useLibrary();
  const book = books.find(item => item.id === id);

  if (ready && book) return <BookReading key={`${book.id}:${book.importedAt}`} book={book} />;

  return (
    <View style={styles.container}>
      <Text style={styles.note}>{!ready ? '本を読み込んでいます…' : '本が見つかりません。本棚に戻って追加してください。'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  note: { fontSize: 14, color: colors.muted },
});
