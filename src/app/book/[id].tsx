import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationButton } from '@/shared/NavigationButton';
import { useAccount } from '@/features/account/AccountProvider';
import { Asset } from 'expo-asset';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { findBook } from '@/content/books';
import { colors } from '@/shared/theme';
import { useLibrary } from '@/features/library/LibraryProvider';
import { BookReading } from '@/features/bookmark/BookReading';
import { IntroComic } from '@/features/comic/IntroComic';
import { widgetPosition } from '@/features/widget/position.mjs';
import { StudyReader } from '@/features/study/StudyReader';

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
    // 開発時のHTTP配信はWebViewから直接読む。端末保存後にBase64で転送する二重読み込みを避ける。
    if (/^https?:/.test(asset.uri)) { setUri(asset.uri); return; }
    asset.downloadAsync().then(a => setUri(a.localUri ?? a.uri)).catch(() => setUri(asset.uri));
  }, [id]);
  return uri;
}

// 教材（PDF）ならPDFの見開き表示、それ以外は青空文庫から追加した小説として開く
export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <>
    <Stack.Screen options={{
      headerLeft: () => <NavigationButton filled flushLeft={Platform.OS !== 'web'} label="本棚へ" onPress={() => router.dismissTo('/shelf')} />,
      // iOSの共有背景が独自ボタンの外側に重なると、白い枠のように見えるため隠す。
      ...(Platform.OS === 'ios' ? { unstable_headerLeftItems: () => [{ type: 'custom' as const, hidesSharedBackground: true, element: <NavigationButton filled flushLeft={Platform.OS !== 'web'} label="本棚へ" onPress={() => router.dismissTo('/shelf')} /> }] } : {}),
    }} />
    {pdfFiles[id] ? <StudyBook id={id} /> : <NovelBook key={id} id={id} />}
  </>;
}

function NovelBook({ id }: { id: string }) {
  const { prefs } = useAccount();
  const { books, ready } = useLibrary();
  const book = books.find(item => item.id === id);
  const { mark } = useLocalSearchParams<{ mark?: string }>();
  const markOffset = book ? widgetPosition(book.text, mark) : undefined;
  const [entry, setEntry] = useState<'intro' | 'read'>('intro');
  const [readingError, setReadingError] = useState('');
  const [readerAttempt, setReaderAttempt] = useState(0);
  const showIntro = markOffset === undefined && prefs.comic && entry !== 'read';
  const readerFailed = useCallback((message: string) => setReadingError(message), []);
  // 本棚からは漫画、しおりのウィジェットからは指定位置の本文を開く。
  useFocusEffect(useCallback(() => { setEntry(markOffset === undefined ? 'intro' : 'read'); }, [id, markOffset]));

  if (ready && book) return <View key={`${book.id}:${book.importedAt}:${mark ?? ''}`} style={{ flex: 1 }}>
    <Stack.Screen options={{ title: book.title, ...(showIntro ? { headerRight: () => null } : {}) }} />
    {/* iOSの非表示WebViewは描画されない場合があるため、漫画を閉じてから本文を作る。 */}
    {!showIntro && <View style={StyleSheet.absoluteFill}>
      <BookReading key={readerAttempt} book={book} hideBookmark={showIntro} initialOffset={markOffset ?? 0} onLoadError={readerFailed} />
    </View>}
    {showIntro && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }]}><IntroComic book={book} read={() => { setReadingError(''); setEntry('read'); }} /></View>}
    {!showIntro && !!readingError && <View style={styles.readerError} accessibilityRole="alert">
      <Text style={styles.loadingText}>{readingError}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setReadingError(''); setReaderAttempt(value => value + 1); }} style={styles.loadingCancel}><Text style={styles.link}>もう一度読み込む</Text></Pressable>
    </View>}

  </View>;

  return (
    <View style={styles.container}>
      <Text style={styles.note}>{!ready ? '本を読み込んでいます…' : '本が見つかりません。本棚に戻って追加してください。'}</Text>
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
    <SafeAreaView edges={['bottom']} style={[styles.container, styles.studyContainer]}>
      <Stack.Screen options={{ title: book.title, headerTitleAlign: 'center', headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink, headerTitle: () => <View style={{ alignItems: 'center' }}><Text style={{ color: colors.ink, fontSize: 20 }}>{book.title}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{book.author}</Text></View> }} />

      <View style={styles.page}>
        <StudyReader key={book.id} book={book} pdfUri={pdfUri} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  readerError: { position: 'absolute', bottom: 12, left: 20, right: 20, backgroundColor: colors.surface, padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 },
  readingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.paper}DD` },
  readingLoading: { maxWidth: 320, margin: 24, padding: 24, gap: 16, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16 },
  loadingText: { color: colors.ink, fontSize: 15, lineHeight: 24, textAlign: 'center' },
  loadingCancel: { padding: 12 },
  shelfButton: { paddingHorizontal: 8, paddingVertical: 12 },
  shelfButtonText: { color: colors.accent, fontSize: 14 },
  container: { flex: 1, padding: 12, gap: 8 },
  studyContainer: { padding: 0, backgroundColor: colors.surface },
  page: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 0,
    borderWidth: 0,
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
