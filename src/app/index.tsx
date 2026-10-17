import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { books } from '@/content/books';
import { Cover } from '@/features/shelf/Cover';
import { useLibrary } from '@/features/library/LibraryProvider';
import { Chips } from '@/shared/Chips';
import { colors, coverColors } from '@/shared/theme';

// 同梱の教材（PDF）。小説は青空文庫から追加したものを並べる。
const studyBooks = books.filter(b => b.kind === 'study');

const kinds = [
  { id: 'all', label: 'すべて' },
  { id: 'novel', label: '小説' },
  { id: 'study', label: '参考書' },
];
const states = [
  { id: 'all', label: 'すべて' },
  { id: 'want', label: '読みたい' },
  { id: 'reading', label: '読んでいる' },
  { id: 'done', label: '読み終わった' },
];

const SLOT = 136;

export default function ShelfScreen() {
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState('all');
  const [state, setState] = useState('all');
  const { books: savedBooks, ready, warning } = useLibrary();
  // 読書状態はまだ記録していないので、「すべて」「読みたい」のときだけ並べる
  const shown = !['all', 'want'].includes(state) ? [] : [
    ...(kind === 'study' ? [] : savedBooks.map(b => ({ id: b.id, title: b.title, author: b.author, label: '小説' }))),
    ...(kind === 'novel' ? [] : studyBooks.map(b => ({ id: b.id, title: b.title, author: b.author, label: '参考書' }))),
  ];

  // 1段に並ぶ冊数を画面幅から決め、段ごとに棚板を敷く
  const perRow = Math.max(2, Math.floor((Math.min(width, 1000) - 48) / SLOT));
  const rows: (typeof shown)[] = [];
  for (let i = 0; i < shown.length; i += perRow) rows.push(shown.slice(i, i + perRow));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.band}>
        <Text style={styles.bandName}>ゲスト</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <View>
            <Text style={styles.eyebrow}>READ. IMAGINE. CONTINUE.</Text>
            <Text style={styles.title}>本棚</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => router.push('/add')}>
            <Text style={styles.addText}>＋ 本を追加</Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          <Chips items={kinds} value={kind} onChange={setKind} />
          <Chips items={states} value={state} onChange={setState} variant="sub" />
        </View>
        {warning ? <Text accessibilityRole="alert" style={styles.message}>{warning}</Text> : null}
        {!ready && <Text style={styles.message}>本棚を読み込んでいます…</Text>}
        {ready && shown.length === 0 && <Text style={styles.message}>この条件の本はありません。</Text>}

        {rows.map((row, r) => (
          <View key={r} style={styles.row}>
            <View style={styles.covers}>
              {row.map((book, i) => (
                <View key={book.id} style={styles.slot}>
                  <Cover
                    title={book.title}
                    author={book.author}
                    label={book.label}
                    color={coverColors[(r * perRow + i) % coverColors.length]}
                    onPress={() => router.push(`/book/${book.id}`)}
                  />
                </View>
              ))}
            </View>
            <View style={styles.board} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  band: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 14 },
  bandName: { color: colors.surface, fontSize: 18 },
  body: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, color: colors.accent, fontWeight: '700' },
  title: { fontSize: 32, color: colors.ink, marginTop: 8 },
  addButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  addText: { color: colors.surface, fontSize: 14 },
  filters: { gap: 8, marginBottom: 12 },
  row: { marginTop: 18 },
  covers: { flexDirection: 'row', paddingHorizontal: 14 },
  slot: { width: SLOT, alignItems: 'center' },
  board: { height: 10, backgroundColor: colors.wood, marginTop: -2 },
  message: { color: colors.muted, fontSize: 14, lineHeight: 22, paddingVertical: 24 },
});
