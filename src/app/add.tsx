import { books as catalog } from '@/content/books';
import { libraryStorage } from '@/features/library/storage';
import { NavigationButton } from '@/shared/NavigationButton';
import { useAccount } from '@/features/account/AccountProvider';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips } from '@/shared/Chips';
import { colors } from '@/shared/theme';
import { useLibrary } from '@/features/library/LibraryProvider';
import type { SavedBook, SearchResult } from '@/features/library/types';
import { recordAdded } from '@/features/stats/stats';

// 本を追加するダイアログ。本棚の上に重ねて表示する。
const tabs = [
  { id: 'novel', label: '小説を探す' },
  { id: 'study', label: '教材を探す' },
];
const fields = [
  { id: 'keyword', label: 'キーワード' },
  { id: 'title', label: 'タイトル' },
  { id: 'author', label: '著者' },
];

const sources = {
  novel: {
    name: '青空文庫',
    text: '日本の文学作品を無料で読める電子図書館です。ここでは青空文庫の著作権が切れた作品だけを検索し、本文と出典を取り込みます。',
    link: '青空文庫について',
    url: 'https://www.aozora.gr.jp/',
  },
  study: {
    name: 'OE Japan',
    text: '大学などが公開しているオープン教材を紹介するサイトです。収録している公開教材をタイトルや著者名で検索できます。',
    link: 'OE Japanについて',
    url: 'https://oejapan.org/',
  },
} as const;

export default function AddScreen() {
  const { complete } = useAccount();
  const [tab, setTab] = useState<'novel' | 'study'>('novel');
  const [field, setField] = useState('keyword');
  const [query, setQuery] = useState('');
  const [studyQuery, setStudyQuery] = useState<string | null>(null);
  const studyResults = catalog.filter(book => book.kind === 'study').filter(book => { const normalize = (value: string) => value.normalize('NFKC').replace(/\s/g, '').toLowerCase(); const q = normalize(studyQuery ?? ''); return normalize(field === 'title' ? book.title : field === 'author' ? book.author : `${book.title}${book.author}`).includes(q); });
  const source = sources[tab];
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { books, ready, warning, addBook } = useLibrary();
  const searchRequest = useRef<AbortController | null>(null);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    searchRequest.current?.abort(); setStudyQuery(null); setResult(null); setError(''); setLoading(false);
  }, [query, field, tab]);
  useEffect(() => () => { searchRequest.current?.abort(); importRequest.current?.abort(); }, []);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/shelf');
  }

  async function search(page = 1) {
    if (adding) return;
    if (tab === 'study') { setStudyQuery(query.trim()); setError(''); return; }
    if (!query.trim()) { setError('タイトルや著者名などを入力してください。'); return; }
    searchRequest.current?.abort();
    const controller = new AbortController(); searchRequest.current = controller;
    setLoading(true); setError(''); setMessage('');
    try {
      const params = new URLSearchParams({ q: query.trim(), field, page: String(page) });
      const response = await fetch(`/api/aozora?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted) setResult(data);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.message.includes('してください') ? reason.message : '検索できません。通信を確認してもう一度検索してください。');
    } finally { if (searchRequest.current === controller) setLoading(false); }
  }

  async function importBook(id: number) {
    if (adding || !ready || warning) return;
    const controller = new AbortController(); importRequest.current = controller;
    setAdding(`aozora-${id}`); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/aozora?id=${id}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (controller.signal.aborted) return;
      await addBook(data as SavedBook);
      complete('add');
      void recordAdded((data as SavedBook).id); // 分析画面の「追加した本」用
      if (!controller.signal.aborted) router.dismissTo('/shelf');
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.message.includes('ください') ? reason.message : '追加できません。通信を確認して再試行してください。');
    } finally { if (!controller.signal.aborted) setAdding(null); }
  }

  return (
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* 背景を押すと閉じる */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />

      <View style={styles.card}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.headRow}>
            <Text style={styles.eyebrow}>ADD A BOOK</Text>
            <NavigationButton close label="閉じる" onPress={close} />
          </View>
          <Text style={styles.title}>本を追加</Text>

          <Chips items={tabs} value={tab} onChange={id => setTab(id as 'novel' | 'study')} variant="segment" />

          <View style={styles.source}>
            <Text style={styles.sourceName}>{source.name}</Text>
            <Text style={styles.note}>{source.text}</Text>
            <Pressable onPress={() => Linking.openURL(source.url)}>
              <Text style={styles.link}>{source.link}</Text>
            </Pressable>
          </View>

          <Chips items={fields} value={field} onChange={setField} variant="segment" />

          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              returnKeyType="search"
              maxLength={80}
              editable={!adding}
              accessibilityLabel={tab === 'study' ? '教材の検索語' : '青空文庫の検索語'}
              placeholder={tab === 'study' ? 'タイトルか著者名（例：熱力学）' : 'タイトルか著者名（例：こころ）'}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Pressable accessibilityRole="button" disabled={loading || !!adding} style={[styles.searchButton, (loading || !!adding) && styles.disabled]} onPress={() => void search()}>
              <Text style={styles.searchText}>{loading ? '検索中' : '検索'}</Text>
            </Pressable>
          </View>

          {(error || warning) ? <Text accessibilityRole="alert" style={styles.feedback}>{error || warning}</Text> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={styles.feedback}>{message}</Text> : null}
          {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="青空文庫を検索しています" />}
          {!result && !loading && tab === 'novel' && <Text style={styles.empty}>例：走れメロス、夏目漱石、銀河鉄道の夜</Text>}
          {tab === 'study' && <>
            <Text style={styles.note}>{studyQuery === null ? '収録教材' : '検索結果'}：{studyResults.length}件</Text>
            {!studyResults.length && <Text style={styles.empty}>見つかりませんでした。別のタイトルや著者名で検索してください。</Text>}
            {studyResults.map(book => <View key={book.id} style={styles.result}><View style={styles.resultInfo}><Text style={styles.bookTitle}>{book.title}</Text><Text style={styles.note}>{book.author}</Text></View>
              <Pressable accessibilityRole="button" disabled={!!adding} style={styles.add} onPress={() => { setAdding(book.id); void (async () => {
                try { const raw = await libraryStorage.getItem('dopabooks:shelf-removed:v1'); const ids = JSON.parse(raw ?? '[]'); if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) throw new Error(); await libraryStorage.setItem('dopabooks:shelf-removed:v1', JSON.stringify(ids.filter(id => id !== book.id))); complete('add'); router.dismissTo('/shelf'); }
                catch { setError('教材を本棚に表示できません。端末の保存設定を確認して再試行してください。'); }
                finally { setAdding(null); }
              })(); }}><Text style={styles.searchText}>本棚に表示</Text></Pressable>
            </View>)}
          </>}
          {result && !loading && <>
            <Text style={styles.note}>{result.total.toLocaleString()}件見つかりました（{result.page}ページ）</Text>
            {!result.results.length && <Text style={styles.empty}>見つかりませんでした。別の語句や検索条件でお試しください。</Text>}
            {result.results.map(book => {
              const exists = books.some(saved => saved.id === book.id);
              return <View key={book.id} style={styles.result}>
                <View style={styles.resultInfo}>
                  <Text style={styles.bookTitle}>{book.title}</Text>
                  {!!book.subtitle && <Text style={styles.note}>{book.subtitle}</Text>}
                  <Text style={styles.note}>{book.author} · {book.characters}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`${book.title}を本棚に追加`} disabled={exists || !!adding || !ready || !!warning}
                  style={[styles.add, (exists || !!adding || !ready || !!warning) && styles.disabled]} onPress={() => void importBook(book.aozoraId)}>
                  <Text style={styles.searchText}>{exists ? '追加済み' : adding === book.id ? '取得中…' : '追加'}</Text>
                </Pressable>
              </View>;
            })}
            <View style={styles.pagination}>
              <Pressable disabled={result.page <= 1 || !!adding} onPress={() => void search(result.page - 1)}><Text style={[styles.close, (result.page <= 1 || !!adding) && styles.disabled]}>前の20件</Text></Pressable>
              <Pressable disabled={result.page * 20 >= result.total || !!adding} onPress={() => void search(result.page + 1)}><Text style={[styles.close, (result.page * 20 >= result.total || !!adding) && styles.disabled]}>次の20件</Text></Pressable>
            </View>
          </>}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(41,46,41,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 640, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden' },
  body: { padding: 28, gap: 18 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: colors.accent, fontWeight: '700' },
  close: { fontSize: 14, color: colors.accent },
  title: { fontSize: 28, color: colors.ink },
  source: { gap: 10, paddingVertical: 6 },
  sourceName: { fontSize: 20, color: colors.ink, fontWeight: '600' },
  note: { fontSize: 13, color: colors.muted, lineHeight: 21 },
  link: { fontSize: 14, color: colors.accent, textDecorationLine: 'underline' },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  searchButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 22, justifyContent: 'center' },
  searchText: { color: colors.surface, fontSize: 15 },
  empty: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  feedback: { color: colors.accent, fontSize: 13, lineHeight: 21 },
  disabled: { opacity: 0.45 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 16 },
  resultInfo: { flex: 1, gap: 4 },
  bookTitle: { fontSize: 17, color: colors.ink },
  add: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
});
