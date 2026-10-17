import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips } from '@/shared/Chips';
import { colors } from '@/shared/theme';

// 本を追加するダイアログ。本棚の上に重ねて表示する。いまは見た目だけで、検索はまだ動かない。
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
    text: '大学などが公開しているオープン教材を紹介するサイトです。ここでは利用条件を確認して選んだ教材だけを検索し、出典を表示して取り込みます。',
    link: 'OE Japanについて',
    url: 'https://oejapan.org/',
  },
} as const;

export default function AddScreen() {
  const [tab, setTab] = useState<'novel' | 'study'>('novel');
  const [field, setField] = useState('keyword');
  const [query, setQuery] = useState('');
  const source = sources[tab];

  return (
    <View style={styles.backdrop}>
      {/* 背景を押すと閉じる */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />

      <View style={styles.card}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.headRow}>
            <Text style={styles.eyebrow}>ADD A BOOK</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.close}>閉じる</Text>
            </Pressable>
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
              placeholder="タイトルか著者名（例：こころ）"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Pressable style={styles.searchButton}>
              <Text style={styles.searchText}>検索</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  searchButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 22, justifyContent: 'center' },
  searchText: { color: colors.surface, fontSize: 15 },
});
