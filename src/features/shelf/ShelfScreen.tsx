import { libraryStorage } from '@/features/library/storage';
import { loadStats, type Stats } from '@/features/stats/stats';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import BookReviews from '@/features/reviews/BookReviews';
import { useAccount } from '@/features/account/AccountProvider';
import { ReadingQuests } from '@/features/shelf/ReadingQuests';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { books } from '@/content/books';
import { Cover } from '@/features/shelf/Cover';
import { useLibrary } from '@/features/library/LibraryProvider';
import { refreshRecommendation } from '@/features/widget/recommend';
import { Chips } from '@/shared/Chips';
import { colors, coverColors } from '@/shared/theme';

// 同梱の教材（PDF）。小説は青空文庫から追加したものを並べる。
const studyBooks = books.filter(b => b.kind === 'study');

const kinds = [
  { id: 'all', label: 'すべて' },
  { id: 'novel', label: '小説' },
  { id: 'study', label: '教材' },
];
const states = [
  { id: 'all', label: 'すべて' },
  { id: 'want', label: '読みたい' },
  { id: 'reading', label: '読んでいる' },
  { id: 'done', label: '読み終わった' },
];

const SLOT = 136;

export default function ShelfScreen() {
  const { prefs } = useAccount();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const [hoverDetails, setHoverDetails] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setHoverDetails(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [removalReady, setRemovalReady] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removalError, setRemovalError] = useState('');
  const [undoBook, setUndoBook] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => { let active = true; void libraryStorage.getItem('dopabooks:shelf-removed:v1').then(raw => {
    const ids = JSON.parse(raw ?? '[]'); if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) throw new Error();
    if (active) { setRemovedIds(ids); setRemovalReady(true); }
  }).catch(() => { if (active) setRemovalError('本棚の削除設定を読み込めません。画面を開き直してください。'); }); return () => { active = false; }; }, []);
  useFocusEffect(useCallback(() => { let active = true; void libraryStorage.getItem('dopabooks:shelf-removed:v1').then(raw => { const ids = JSON.parse(raw ?? '[]'); if (active && Array.isArray(ids) && ids.every(id => typeof id === 'string')) setRemovedIds(ids); }).catch(() => {}); return () => { active = false; }; }, []));
  async function changeRemoved(id: string, remove: boolean) {
    if (removing || !removalReady) return;
    setRemoving(true); setRemovalError('');
    const next = remove ? [...new Set([...removedIds, id])] : removedIds.filter(item => item !== id);
    try { await libraryStorage.setItem('dopabooks:shelf-removed:v1', JSON.stringify(next)); setRemovedIds(next); if (remove) { const book = [...savedBooks, ...studyBooks].find(item => item.id === id); setUndoBook({ id, title: book?.title ?? '本' }); setDetailId(null); setRemoveConfirm(false); } else setUndoBook(null); }
    catch { setRemovalError('本棚を変更できません。端末の保存設定を確認し、もう一度お試しください。'); }
    finally { setRemoving(false); }
  }
  const [detailId, setDetailId] = useState<string | null>(null);
  const [measured, setMeasured] = useState(0); // 棚の実際の幅
  const [kind, setKind] = useState('all');
  const [state, setState] = useState('all');
  const { books: savedBooks, ready, warning } = useLibrary();
  // 本棚を開いたら、ウィジェットの「今日のおすすめ」を選び直す（同じ日は同じ本。星はレビューの実際の集計）
  useEffect(() => { if (ready) void refreshRecommendation(savedBooks.filter(book => !removedIds.includes(book.id))); }, [ready, savedBooks, removedIds]);
  const [readingStats, setReadingStats] = useState<Stats | null>(null);
  useFocusEffect(useCallback(() => { let active = true; void loadStats().then(value => { if (active) setReadingStats(value); }); return () => { active = false; }; }, []));
  const shown = [
    ...(kind === 'study' ? [] : savedBooks.map(b => ({ id: b.id, title: b.title, author: b.author, label: '小説' }))),
    ...(kind === 'novel' ? [] : studyBooks.map(b => ({ id: b.id, title: b.title, author: b.author, label: '教材' }))),
  ].filter(book => {
    if (removedIds.includes(book.id)) return false;
    const status = readingStats?.books[book.id]?.finishedAt ? 'done' : readingStats?.sessions.some(item => item.bookId === book.id) ? 'reading' : 'want';
    return state === 'all' || state === status;
  });

  // 1段に並ぶ冊数は、実際の棚の幅（測った値）から決め、段ごとに棚板を敷く。
  // 余った幅は本と本の間に均等に分けて、棚の右に余白が残らないようにする。
  // 狭い画面（iPhone）でも最低3冊は並べ、その分だけ表紙を小さくする。
  const shelfWidth = (measured || Math.min(width - (desktop ? 220 : 0), 1000) - 48) - 28;
  const perRow = Math.max(3, Math.floor(shelfWidth / SLOT));
  const slot = shelfWidth / perRow;
  const rows: (typeof shown)[] = [];
  for (let i = 0; i < shown.length; i += perRow) rows.push(shown.slice(i, i + perRow));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!desktop && <View style={styles.band}>
        <Image source={require('../../../assets/images/dopabooks-mark-white.png')} accessibilityLabel="白いドパBOOKs シンボルマーク" resizeMode="contain" style={styles.brandMark} />
        <Image source={require('../../../assets/images/dopabooks-wordmark.png')} accessibilityLabel="ドパBOOKS" resizeMode="contain" style={styles.brandWordmark} />
      </View>}

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <View>
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
        {!!removalError && <Text accessibilityRole="alert" style={styles.message}>{removalError}</Text>}
        {warning ? <Text accessibilityRole="alert" style={styles.message}>{warning}</Text> : null}
        {!ready && <Text style={styles.message}>本棚を読み込んでいます…</Text>}
        {ready && shown.length === 0 && <Text style={styles.message}>この条件の本はありません。</Text>}

        {/* 棚の実際の幅を測る（冊数と本の間隔を決めるため） */}
        <View onLayout={e => setMeasured(e.nativeEvent.layout.width)} />
        {rows.map((row, r) => (
          <View key={r} style={styles.row}>
            <View style={styles.covers}>
              {row.map((book, i) => (
                <View key={book.id} style={[styles.slot, { width: slot }]}>
                  <Cover
                    title={book.title}
                    author={book.author}
                    label={book.label}
                    color={coverColors[(r * perRow + i) % coverColors.length]}
                    width={Math.min(112, slot - 12)}
                    onPress={() => router.push(`/book/${book.id}`)}
                    onDetails={() => { setRemoveConfirm(false); setDetailId(book.id); }}
                    hoverDetails={hoverDetails}
                  />
                </View>
              ))}
            </View>
            <View style={styles.board} />
          </View>
        ))}
      </ScrollView>
      <ReadingQuests />
      <Modal visible={detailId !== null} transparent animationType="fade" onRequestClose={() => setDetailId(null)}>
        <View style={styles.detailOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="本の紹介を閉じる" onPress={() => setDetailId(null)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={styles.detailPanel}>{detailId && <BookReviews key={detailId} bookId={detailId} close={() => setDetailId(null)} />}
            {removeConfirm ? <View style={styles.removeArea}><Text style={{ color: colors.ink, fontSize: 16 }}>この本を本棚から削除しますか？</Text><Text style={{ color: colors.muted, fontSize: 13 }}>感想や読書記録は残ります。</Text><View style={{ flexDirection: 'row', gap: 12 }}><Pressable accessibilityRole="button" disabled={removing} onPress={() => setRemoveConfirm(false)} style={styles.removeButton}><Text style={{ color: colors.ink }}>キャンセル</Text></Pressable><Pressable accessibilityRole="button" disabled={removing} onPress={() => detailId && void changeRemoved(detailId, true)} style={[styles.removeButton, { backgroundColor: colors.dangerBackground }]}><Text style={{ color: colors.danger }}>{removing ? '削除中…' : '削除する'}</Text></Pressable></View>{!!removalError && <Text accessibilityRole="alert">{removalError}</Text>}</View>
              : detailId && removedIds.includes(detailId) ? <View style={styles.removeArea}><Pressable accessibilityRole="button" disabled={removing} onPress={() => void changeRemoved(detailId, false)} style={styles.removeButton}><Text style={{ color: colors.accent }}>本棚に戻す</Text></Pressable></View>
              : <View style={styles.removeArea}><Pressable accessibilityRole="button" disabled={!removalReady} onPress={() => setRemoveConfirm(true)} style={[styles.removeButton, { backgroundColor: colors.dangerBackground }]}><Text style={{ color: colors.danger }}>本棚から削除</Text></Pressable></View>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  removeArea: { padding: 16, gap: 10, backgroundColor: colors.surface },
  removeButton: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.button, borderRadius: 999, alignItems: 'center' },
  detailOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(30,38,31,0.24)' },
  detailPanel: { width: '100%', maxWidth: 680, height: '86%', maxHeight: 780, backgroundColor: colors.paper, borderRadius: 22, overflow: 'hidden', boxShadow: '0 12px 48px rgba(25,36,27,0.18)' },
  safe: { flex: 1, backgroundColor: colors.paper },
  band: { minHeight: 64, backgroundColor: colors.accent, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 56, height: 42 },
  brandWordmark: { width: 150, height: 27 },
  statsIcon: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, padding: 4 },
  statsBook: { width: 7, backgroundColor: colors.surface, borderRadius: 1.5, overflow: 'hidden', alignItems: 'center' },
  statsSpine: { width: 7, height: 2, marginTop: 3, backgroundColor: colors.accent, opacity: 0.45 },
  bandName: { color: colors.surface, fontSize: 18 },
  body: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  // 見出しはタイムラインと同じ大きさ・太さにし、右のボタンと上下中央でそろえる
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '600', color: colors.ink, marginTop: 8 },
  addButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  addText: { color: colors.surface, fontSize: 14 },
  filters: { gap: 8, marginBottom: 12 },
  row: { marginTop: 18 },
  covers: { flexDirection: 'row', paddingHorizontal: 14 },
  slot: { width: SLOT, alignItems: 'center' },
  // 棚板：少し茶色に寄せた木の色
  board: { height: 10, backgroundColor: '#B79A72', marginTop: -2, boxShadow: '0 6px 8px rgba(41,46,41,0.22)' },
  message: { color: colors.muted, fontSize: 14, lineHeight: 22, paddingVertical: 24 },
});
