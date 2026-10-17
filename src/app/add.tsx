import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips } from '@/shared/Chips';
import { colors } from '@/shared/theme';
import { useLibrary } from '@/features/library/LibraryProvider';
import type { SavedBook, SearchResult } from '@/features/library/types';

const tabs = [
  { id: 'novel', label: '小説を探す' },
  { id: 'study', label: '教材を探す' },
];
const fields = [
  { id: 'keyword', label: 'キーワード' },
  { id: 'title', label: 'タイトル' },
  { id: 'author', label: '著者' },
];

export default function AddScreen() {
  const [tab, setTab] = useState('novel');
  const [field, setField] = useState('keyword');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { books, ready, warning, addBook } = useLibrary();
  const searchRequest = useRef<AbortController | null>(null);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    searchRequest.current?.abort(); setResult(null); setError(''); setLoading(false);
  }, [query, field, tab]);
  useEffect(() => () => { searchRequest.current?.abort(); importRequest.current?.abort(); }, []);

  async function search(page = 1) {
    if (tab !== 'novel' || adding) return;
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
      await addBook(data as SavedBook); setMessage(`「${data.title}」を本棚に追加しました。`);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.message.includes('ください') ? reason.message : '追加できません。通信を確認して再試行してください。');
    } finally { if (!controller.signal.aborted) setAdding(null); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <Text style={styles.eyebrow}>ADD A BOOK</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.close}>閉じる</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>本を追加</Text>

      <Chips items={tabs} value={tab} onChange={setTab} variant="segment" />

      <Text style={styles.note}>
        {tab === 'novel' ? '青空文庫の公開作品を、タイトルや著者から検索します。追加した本はこのブラウザーに保存します。' : '教材の検索は準備中です。「小説を探す」から青空文庫の作品を追加できます。'}
      </Text>

      <Chips items={fields} value={field} onChange={setField} variant="segment" />

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          returnKeyType="search"
          maxLength={80}
          editable={tab === 'novel' && !adding}
          accessibilityLabel="青空文庫の検索語"
          placeholder="タイトルか著者名"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable accessibilityRole="button" disabled={loading || !!adding || tab !== 'novel'} style={[styles.searchButton, (loading || !!adding || tab !== 'novel') && styles.disabled]} onPress={() => void search()}>
          <Text style={styles.searchText}>{loading ? '検索中' : '検索'}</Text>
        </Pressable>
      </View>

      {(error || warning) ? <Text accessibilityRole="alert" style={styles.feedback}>{error || warning}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.feedback}>{message}</Text> : null}
      {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="青空文庫を検索しています" />}
      {!result && !loading && tab === 'novel' && <Text style={styles.empty}>例：走れメロス、夏目漱石、銀河鉄道の夜</Text>}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  body: { padding: 24, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, color: colors.accent, fontWeight: '700' },
  close: { fontSize: 13, color: colors.accent },
  title: { fontSize: 24, color: colors.ink },
  note: { fontSize: 12, color: colors.muted, lineHeight: 19 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  searchButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  searchText: { color: colors.surface, fontSize: 14 },
  empty: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  feedback: { color: colors.accent, fontSize: 13, lineHeight: 21 },
  disabled: { opacity: 0.45 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 16 },
  resultInfo: { flex: 1, gap: 4 },
  bookTitle: { fontSize: 17, color: colors.ink },
  add: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
});
