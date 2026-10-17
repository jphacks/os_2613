import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SavedBook } from '@/features/library/types';
import { colors } from '@/shared/theme';
import { bookmarkPage, createReadingStore, emptyReading, pageAt, placeMark, readingPages, removeMark, summaryRange, type Mark, type Reading, type Scope } from './model.mjs';
import { Summary } from './Summary';

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
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
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
  async function go(index: number) {
    if (await save(state => ({ ...state, cursor: pages[index].start }))) { setPage(index); scroll.current?.scrollTo({ y: 0, animated: false }); return true; }
    return false;
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
  let position = current.start;
  const characters = Array.from(current.text).map(char => { const start = position; position += char.length; return { char, start, end: position }; });
  function ribbon(offset: number) {
    const mark = reading.marks.find(item => item.offset === offset);
    return <>{mark && <Text accessibilityLabel="しおり" onPress={() => { if (!moving) { setSelected(mark.id); setScope('previous'); setPanel(true); } }} style={[styles.ribbon, mark.id === moving && styles.faded]}>▮</Text>}{moving && draft === offset && <Text style={styles.ribbon}>▮</Text>}</>;
  }
  return <View style={styles.screen}>
    <View style={styles.toolbar}><Action disabled={!ready || busy || !!moving} onPress={() => begin()}>しおりを挟む</Action><Action disabled={!ready || busy || !!moving} onPress={() => { setSelected(null); setPanel(true); }}>しおり一覧</Action></View>
    {!!error && <Text accessibilityRole="alert" style={styles.message}>{error}</Text>}
    {!!notice && <View style={styles.toolbar}><Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>{undo && <Action disabled={busy} onPress={() => void undoMove()}>元に戻す</Action>}</View>}
    {moving && <View style={styles.placement}><Text style={styles.note}>読み終えた最後の文字を押してください。ページを移って選ぶこともできます。</Text><View style={styles.toolbar}><Action disabled={busy || draft === null} filled onPress={() => void confirm()}>この位置に挟む</Action><Action disabled={busy} onPress={() => { setMoving(null); setDraft(null); }}>キャンセル</Action></View></View>}
    <ScrollView ref={scroll} style={styles.paper} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{book.title}</Text><Text style={styles.note}>{book.author}</Text>
      <Text selectable={!moving} style={styles.body}>{ribbon(current.start)}{characters.map(({ char, start, end }) => <Text key={start} onPress={moving ? () => setDraft(end) : undefined} style={moving && draft === end ? styles.chosen : undefined}>{char}{ribbon(end)}</Text>)}</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(book.cardUrl)}><Text style={styles.note}>出典：青空文庫</Text></Pressable>
    </ScrollView>
    <View style={styles.paging}><Action disabled={!ready || busy || page >= pages.length - 1} onPress={() => void go(page + 1)}>‹ 次のページ</Action><Text style={styles.note}>{page + 1} / {pages.length}</Text><Action disabled={!ready || busy || page === 0} onPress={() => void go(page - 1)}>前のページ ›</Action></View>
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
  title: { color: colors.ink, fontSize: 23 }, heading: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  paper: { flex: 1, marginHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.surface },
  content: { padding: 24, gap: 12 }, body: { color: colors.ink, fontSize: 18, lineHeight: 34, paddingVertical: 16 },
  ribbon: { color: colors.accent, fontWeight: 'bold' }, faded: { opacity: 0.25 }, chosen: { backgroundColor: colors.line },
  placement: { paddingHorizontal: 12, paddingVertical: 8 }, paging: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, gap: 6 },
  overlay: { flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 16 }, sheet: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, maxHeight: '95%', width: '100%', maxWidth: 720, alignSelf: 'center' },
  sheetContent: { padding: 16, gap: 20 }, markCard: { gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line },
});
