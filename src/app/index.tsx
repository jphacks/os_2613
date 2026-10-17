import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

// 本棚の画面。いまは仮の本を1冊だけ並べる。
export default function ShelfScreen() {
  return (
    <View style={styles.container}>
      <Link href="/book/sample" asChild>
        <Pressable style={styles.cover}>
          <Text style={styles.coverTitle}>走れメロス</Text>
          <Text style={styles.coverAuthor}>太宰 治</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  cover: {
    width: 120,
    height: 180,
    padding: 14,
    borderRadius: 4,
    backgroundColor: colors.accent,
    justifyContent: 'space-between',
  },
  coverTitle: { color: colors.surface, fontSize: 16 },
  coverAuthor: { color: colors.surface, fontSize: 11, opacity: 0.8 },
});
