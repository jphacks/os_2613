import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips } from '@/shared/Chips';
import { colors } from '@/shared/theme';

// 本を追加する画面。いまは見た目だけで、検索はまだ動かない。
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
        {tab === 'novel' ? '著作権の切れた作品を、青空文庫から探して取り込みます。' : '公開されている教材から探して取り込みます。'}
      </Text>

      <Chips items={fields} value={field} onChange={setField} variant="segment" />

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="タイトルか著者名"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable style={styles.searchButton}>
          <Text style={styles.searchText}>検索</Text>
        </Pressable>
      </View>

      <Text style={styles.empty}>検索結果はここに並びます。</Text>
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
});
