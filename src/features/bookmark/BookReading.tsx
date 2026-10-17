import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SavedBook } from '@/features/library/types';
import { colors } from '@/shared/theme';
import { bookmarkPage, createReadingStore, emptyReading, pageAt, placeMark, readingPages, removeMark, summaryRange, type Mark, type Reading, type Scope } from './model.mjs';
import { Summary } from './Summary';
import VerticalPage from '@/features/reader/VerticalPage';

// 読みガイドの速さ（1分あたりの文字数）の選択肢
const speeds = [300, 500, 800, 1200];

function Action({ children, onPress, disabled = false, filled = false }: { children: string; onPress: () => void; disabled?: boolean; filled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, filled && styles.filled, disabled && styles.disabled]}><Text style={[styles.buttonText, filled && styles.light]}>{children}</Text></Pressable>;
}

export function BookReading({ book }: { book: SavedBook }) {
  const store = useMemo(() => createReadingStore(AsyncStorage, `dopabooks:reading:v1:${book.id}`, book.text), [book.id, book.text]);
  const pages = useMemo(() => readingPages(book.text), [book.text]);
  const [reading, setReading] = useState<Reading>(() => emptyReading(book.text));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('previous');
  const [moving, setMoving] = useState<string | null>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ before: Mark; after: Mark } | null>(null);
  const [guide, setGuide] = useState(false);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [sub, setSub] = useState(0);
  const [subCount, setSubCount] = useState(1);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void store.load().then(value => { if (alive.current) { setReading(value); setPage(pageAt(pages, value.cursor)); setReady(true); } })
      .catch(() => { if (alive.current) setError('読書記録を読み込めません。端末の保存設定や本文の変更を確認し、本を開き直してください。記録は上書きしていません。'); });
    return () => { alive.current = false; };
  }, [store, pages]);

  async function save(change: (state: Reading) => Reading) {
    if (!ready || busy) return false;
    setBusy(true); setError('');
    try { const value = await store.save(change); if (alive.current) setReading(value); return true; }
    catch (reason) { if (alive.current) setError(reason instanceof Error && reason.message.includes('してください') ? reason.message : '記録を保存できません。端末の空き容量や保存設定を確認して、もう一度お試しください。'); return false; }
    finally { if (alive.current) setBusy(false); }
  }
  // sub は区切ったページのどこから見せるか（-1 は最後のページ。前へ戻るときに使う）
  async function go(index: number, from = 0) {
    if (await save(state => ({ ...state, cursor: pages[index].start }))) { setPage(index); setSub(from); return true; }
    return false;
  }
  // 紙面は画面に収まる行数ごとに区切って見せる。区切りの端まで来たら、本文の次（前）のまとまりへ。
  const shown = sub < 0 ? subCount - 1 : Math.min(sub, subCount - 1);
  const progress = Math.round(((page + (shown + 1) / subCount) / pages.length) * 100);
  function next() {
    if (busy) return;
    if (shown < subCount - 1) setSub(shown + 1);
    else if (page < pages.length - 1) void go(page + 1).then(ok => { if (!ok) setRunning(false); });
    else setRunning(false);
  }
  function prev() {
    if (busy) return;
    if (shown > 0) setSub(shown - 1);
    else if (page > 0) void go(page - 1, -1);
  }
  function begin(id?: string) {
    setMoving(id ?? `mark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    setDraft(null); setPanel(false); setNotice('');
  }
  async function confirm() {
    if (!moving || draft === null) return;
    const before = reading.marks.find(mark => mark.id === moving);
    let after: Mark | undefined;
    if (await save(state => { const next = placeMark(state, book.text, draft, moving); after = next.marks.find(mark => mark.id === moving); return next; })) {
      if (before && after) setUndo({ before, after }); else setUndo(null);
      setMoving(null); setDraft(null); setNotice(before ? 'しおりを移動しました。' : 'しおりを挟みました。');
    }
  }
  async function undoMove() {
    if (!undo) return;
    const { before, after } = undo;
    if (await save(state => {
      if (!state.marks.some(mark => mark.id === after.id && mark.offset === after.offset && mark.updatedAt === after.updatedAt) || state.marks.some(mark => mark.id !== before.id && mark.offset === before.offset)) throw new Error('別の操作が行われたため、しおり一覧から位置を選び直してください。');
      return { ...state, marks: state.marks.map(mark => mark.id === before.id ? before : mark) };
    })) { setUndo(null); setNotice('元のしおり位置に戻しました。'); }
  }
  const current = pages[page];
  const target = reading.marks.find(mark => mark.id === selected);
  const range = target ? summaryRange(book.text, reading.marks, target.id, scope) : null;
  const sorted = [...reading.marks].sort((a, b) => b.updatedAt - a.updatedAt);
  // 紙面のしおりを押したら、そのしおりのふりかえりを開く
  function openMark(offset: number) {
    const mark = reading.marks.find(item => item.offset === offset);
    if (mark && !moving) { setSelected(mark.id); setScope('previous'); setPanel(true); }
  }
  return <View style={styles.screen}>
    {/* ヘッダー：中央にタイトルと作者、右にしおりの操作 */}
    <Stack.Screen options={{
      headerTitleAlign: 'center',
      headerTitle: () => <View style={styles.headTitle}><Text style={styles.title}>{book.title}</Text><Text style={styles.small}>{book.author}</Text></View>,
      headerRight: () => <View style={styles.headRight}>
        <Action disabled={!ready || busy || !!moving} onPress={() => begin()}>しおりを挟む</Action>
        <Action disabled={!ready || busy || !!moving} onPress={() => { setSelected(null); setPanel(true); }}>しおり一覧</Action>
      </View>,
    }} />
    {/* 読みガイドの操作は横1列。入りきらないときは横にスクロール */}
    <ScrollView horizontal style={styles.bar} contentContainerStyle={styles.barContent} showsHorizontalScrollIndicator={false}>
      <Action filled={guide} onPress={() => { setGuide(value => !value); setRunning(false); }}>{guide ? '読みガイド ON' : '読みガイド OFF'}</Action>
      {guide && <>
        <Action disabled={!ready || !!moving} onPress={() => setRunning(value => !value)}>{running ? '一時停止' : 'ガイドを開始'}</Action>
        {speeds.map(value => <Action key={value} filled={speed === value} onPress={() => setSpeed(value)}>{`${value}字/分`}</Action>)}
      </>}
    </ScrollView>
    {!!error && <Text accessibilityRole="alert" style={styles.message}>{error}</Text>}
    {!!notice && <View style={styles.toolbar}><Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>{undo && <Action disabled={busy} onPress={() => void undoMove()}>元に戻す</Action>}</View>}
    {moving && <View style={styles.placement}><Text style={styles.note}>読み終えた最後の文字を押してください。ページを移って選ぶこともできます。</Text><View style={styles.toolbar}><Action disabled={busy || draft === null} filled onPress={() => void confirm()}>この位置に挟む</Action><Action disabled={busy} onPress={() => { setMoving(null); setDraft(null); }}>キャンセル</Action></View></View>}
    {/* 紙面は画面いっぱい。左側を押すと次、右側を押すと前のページ */}
    <View style={styles.paper}>
      <VerticalPage
        text={current.text}
        start={current.start}
        sub={sub}
        marks={reading.marks.map(mark => mark.offset)}
        faded={reading.marks.find(mark => mark.id === moving)?.offset ?? null}
        picking={!!moving}
        draft={draft}
        guide={guide}
        running={running}
        speed={speed}
        onPick={offset => setDraft(offset)}
        onMarkPress={openMark}
        onPages={setSubCount}
        onNext={next}
        onPrev={prev}
        dom={{ style: { flex: 1 } }}
      />
    </View>
    <Pressable accessibilityRole="link" style={styles.source} onPress={() => void Linking.openURL(book.cardUrl)}><Text style={styles.note}>出典：青空文庫</Text></Pressable>
    {/* 進み具合：縦書きなので右から左へ伸びるバー */}
    <View style={styles.paging}>
      <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
      <Text style={styles.note}>{progress}%</Text>
    </View>
    <Modal visible={panel} transparent animationType="slide" onRequestClose={() => setPanel(false)}>
      <View style={styles.overlay}><View style={styles.sheet}><View style={styles.toolbar}><Text style={styles.heading}>{target ? 'ふりかえり' : 'しおり'}</Text><Action onPress={() => setPanel(false)}>閉じる</Action></View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          {target && range ? <>
            <Action onPress={() => setSelected(null)}>‹ しおり一覧へ</Action>
            <View style={styles.toolbar}>{([{ id: 'previous', label: '前回から' }, { id: 'chapter', label: 'この章' }, { id: 'start', label: '最初から' }] as const).map(item => <Action key={item.id} filled={scope === item.id} onPress={() => setScope(item.id)}>{item.label}</Action>)}</View>
            <Summary key={`${target.id}:${target.updatedAt}:${scope}:${range.start}:${range.end}`} text={range.text} cacheKey={`dopabooks:summary:v1:${book.id}:${reading.source}:${range.start}:${range.end}`} />
            <View style={styles.toolbar}><Action disabled={busy} filled onPress={() => { void go(bookmarkPage(pages, target.offset)).then(ok => { if (ok) setPanel(false); }); }}>ここから読む</Action><Action disabled={busy} onPress={() => begin(target.id)}>しおりを移動</Action><Action disabled={busy} onPress={() => { void save(state => removeMark(state, target.id)).then(ok => { if (ok) { setSelected(null); setUndo(null); } }); }}>外す</Action></View>
          </> : <>
            {!sorted.length && <Text style={styles.note}>しおりはまだありません。本文の文字を選んで挟めます。</Text>}
            {sorted.map((mark, index) => <View key={mark.id} style={styles.markCard}><Text style={styles.heading}>しおり {sorted.length - index}</Text><Text style={styles.note}>{book.text.slice(Math.max(0, mark.offset - 65), mark.offset) || '本文のはじまり'}</Text><View style={styles.toolbar}><Action onPress={() => { setSelected(mark.id); setScope('previous'); }}>ふりかえり</Action><Action disabled={busy} onPress={() => { void go(bookmarkPage(pages, mark.offset)).then(ok => { if (ok) setPanel(false); }); }}>ここから読む</Action><Action disabled={busy} onPress={() => begin(mark.id)}>移動</Action><Action disabled={busy} onPress={() => { void save(state => removeMark(state, mark.id)).then(ok => { if (ok) setUndo(null); }); }}>外す</Action></View></View>)}
          </>}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 10 },
  button: { paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface },
  buttonText: { color: colors.accent, fontSize: 14 }, filled: { backgroundColor: colors.accent }, light: { color: colors.surface }, disabled: { opacity: 0.4 },
  message: { color: colors.ink, backgroundColor: colors.surface, padding: 12, lineHeight: 24 }, note: { color: colors.muted, fontSize: 14, lineHeight: 24 },
  title: { color: colors.ink, fontSize: 17, letterSpacing: 3, fontFamily: 'serif' }, heading: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  paper: { flex: 1, marginHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surface },
  headTitle: { alignItems: 'center' }, small: { color: colors.muted, fontSize: 11, marginTop: 2 }, headRight: { flexDirection: 'row', gap: 8, marginRight: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, flexDirection: 'row-reverse', overflow: 'hidden' }, fill: { backgroundColor: colors.accent },
  bar: { flexGrow: 0 }, barContent: { gap: 8, alignItems: 'center', padding: 10 },
  source: { alignSelf: 'center', paddingTop: 6 },
  placement: { paddingHorizontal: 12, paddingVertical: 8 }, paging: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  overlay: { flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 16 }, sheet: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, maxHeight: '95%', width: '100%', maxWidth: 720, alignSelf: 'center' },
  sheetContent: { padding: 16, gap: 20 }, markCard: { gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line },
});
