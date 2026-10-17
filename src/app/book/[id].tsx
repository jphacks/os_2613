import { useAccount } from '@/features/account/AccountProvider';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { findBook } from '@/content/books';
import PdfBook from '@/features/pdf/PdfBook';
import { colors } from '@/shared/theme';
import { useLibrary } from '@/features/library/LibraryProvider';
import { BookReading } from '@/features/bookmark/BookReading';
import { IntroComic } from '@/features/comic/IntroComic';
import { parseReading } from '@/features/bookmark/model.mjs';

// 同梱している教材のPDF。require は静的に書く必要があるので、ここで本のIDと結びつける。
const pdfFiles: Record<string, number> = {
  calculus: require('../../../assets/books/oej/calculus.pdf'),
  thermodynamics: require('../../../assets/books/oej/thermodynamics.pdf'),
  'mathematics-for-economics': require('../../../assets/books/oej/mathematics-for-economics.pdf'),
  'ai-for-teachers': require('../../../assets/books/oej/ai-for-teachers.pdf'),
};

// PDFの場所（Webならアドレス、iPhoneなら端末内のファイル）を求める
function usePdfUri(id: string) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    const file = pdfFiles[id];
    if (!file) return;
    const asset = Asset.fromModule(file);
    asset.downloadAsync().then(a => setUri(a.localUri ?? a.uri)).catch(() => setUri(asset.uri));
  }, [id]);
  return uri;
}

// 教材（PDF）ならPDFの見開き表示、それ以外は青空文庫から追加した小説として開く
export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <>
    <Stack.Screen options={{ headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="本棚へ戻る" onPress={() => router.dismissTo('/shelf')} style={styles.shelfButton}><Text style={styles.shelfButtonText}>← 本棚へ</Text></Pressable> }} />
    {pdfFiles[id] ? <StudyBook id={id} /> : <NovelBook id={id} />}
  </>;
}

function NovelBook({ id }: { id: string }) {
  const { prefs } = useAccount();
  const { books, ready } = useLibrary();
  const book = books.find(item => item.id === id);
  // ウィジェットから開いたときは ?mark=しおりの位置 が付くので、紹介の漫画を飛ばしてその位置から表示する
  const { mark } = useLocalSearchParams<{ mark?: string }>();
  const markOffset = mark !== undefined && Number.isFinite(Number(mark)) ? Math.max(0, Number(mark) - 1) : undefined;
  const [entry, setEntry] = useState<'loading' | 'intro' | 'read'>('loading');
  const [offset, setOffset] = useState<number | undefined>(markOffset);
  useEffect(() => {
    if (!book) return;
    if (markOffset !== undefined) { setOffset(markOffset); setEntry('read'); return; }
    let active = true;
    void Promise.all([AsyncStorage.getItem(`dopabooks:opened:v1:${book.id}`), AsyncStorage.getItem(`dopabooks:reading:v1:${book.id}`)]).then(([opened, raw]) => {
      const reading = parseReading(raw, book.text);
      if (active) setEntry(opened === book.importedAt || reading.cursor > 0 || reading.marks.length ? 'read' : 'intro');
    }).catch(() => { if (active) setEntry('read'); });
    return () => { active = false; };
  }, [book, markOffset]);

  if (ready && book && entry !== 'loading') return <View key={`${book.id}:${book.importedAt}:${mark ?? ''}`} style={{ flex: 1 }}>
    <Stack.Screen options={{ title: book.title }} />
    {entry === 'intro' && prefs.comic ? <IntroComic book={book} read={() => { setOffset(0); setEntry('read'); void AsyncStorage.setItem(`dopabooks:opened:v1:${book.id}`, book.importedAt).catch(() => {}); }} /> : <BookReading book={book} initialOffset={offset} />}
  </View>;

  return (
    <View style={styles.container}>
      <Text style={styles.note}>{!ready || (book && entry === 'loading') ? '本を読み込んでいます…' : '本が見つかりません。本棚に戻って追加してください。'}</Text>
    </View>
  );
}

function StudyBook({ id }: { id: string }) {
  const book = findBook(id);
  const pdfUri = usePdfUri(id);

  if (!book) {
    return (
      <View style={styles.container}>
        <Text style={styles.note}>この本は見つかりません。本棚から開き直してください。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: book.title }} />

      <View style={styles.page}>
        {pdfFiles[book.id] ? (
          pdfUri ? (
            <PdfBook uri={pdfUri} dom={{ style: { flex: 1 } }} />
          ) : (
            <Text style={styles.note}>教材を準備しています…</Text>
          )
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>{book.author}</Text>
            <Text style={styles.note}>本文はここに表示されます</Text>
          </View>
        )}
      </View>

      {book.source && (
        <View style={styles.credit}>
          <Text style={styles.creditText}>
            {book.author}「{book.title}」　利用条件：{book.license}
          </Text>
          <Pressable onPress={() => Linking.openURL(book.source!)}>
            <Text style={styles.link}>公式配布ページ</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shelfButton: { paddingHorizontal: 8, paddingVertical: 12 },
  shelfButtonText: { color: colors.accent, fontSize: 14 },
  container: { flex: 1, padding: 12, gap: 8 },
  page: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  placeholder: { padding: 24 },
  title: { fontSize: 22, color: colors.ink },
  author: { fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 16 },
  note: { fontSize: 14, color: colors.muted, padding: 24 },
  credit: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  creditText: { fontSize: 11, color: colors.muted, flexShrink: 1 },
  link: { fontSize: 11, color: colors.accent, textDecorationLine: 'underline' },
});
