import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SavedBook } from '@/features/library/types';
import { colors } from '@/shared/theme';
import { createReadingStore, emptyReading, placeMark, removeMark, summaryRange, type Mark, type Reading, type Scope } from './model.mjs';
import { Summary } from './Summary';
import VerticalPage from '@/features/reader/VerticalPage';
import { DisplaySettings, paperColors } from '@/features/reader/DisplaySettings';
import { PageBar } from '@/features/reader/PageBar';
import { IntroComic } from '@/features/comic/IntroComic';
import { Characters } from '@/features/characters/Characters';
import { defaultPreferences, normalizePreferences, preferenceKey, type DisplayPreferences } from '@/features/reader/preferences.mjs';

// 読みガイドの速さ（1分あたりの文字数）の選択肢
const speeds = [300, 500, 800, 1200];

function Action({ children, onPress, disabled = false, filled = false }: { children: string; onPress: () => void; disabled?: boolean; filled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, filled && styles.filled, disabled && styles.disabled]}><Text style={[styles.buttonText, filled && styles.light]}>{children}</Text></Pressable>;
}

export function BookReading({ book, initialOffset }: { book: SavedBook; initialOffset?: number }) {
  const store = useMemo(() => createReadingStore(AsyncStorage, `dopabooks:reading:v1:${book.id}`, book.text), [book.id, book.text]);
  const [reading, setReading] = useState<Reading>(() => emptyReading(book.text));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
  const [display, setDisplay] = useState<DisplayPreferences>({ ...defaultPreferences });
  const [displayReady, setDisplayReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feature, setFeature] = useState<'comic' | 'characters' | null>(null);
  const [focus, setFocus] = useState<{ offset: number; token: number } | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(preferenceKey).then(raw => { if (active && raw) setDisplay(normalizePreferences(JSON.parse(raw))); })
      .catch(() => { if (active) setError('表示設定を読み込めません。端末の保存設定を確認してください。標準の表示で開いています。'); })
      .finally(() => { if (active) setDisplayReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    alive.current = true;
    void store.load().then(value => { if (alive.current) { setReading(value); setFocus({ offset: initialOffset ?? value.cursor, token: Date.now() }); setReady(true); } })
      .catch(() => { if (alive.current) setError('読書記録を読み込めません。端末の保存設定や本文の変更を確認し、本を開き直してください。記録は上書きしていません。'); });
    return () => { alive.current = false; if (viewTimer.current) clearTimeout(viewTimer.current); };
  }, [store, initialOffset]);

  async function save(change: (state: Reading) => Reading) {
    if (!ready || busy) return false;
    setBusy(true); setError('');
    try { const value = await store.save(change); if (alive.current) setReading(value); return true; }
    catch (reason) { if (alive.current) setError(reason instanceof Error && reason.message.includes('してください') ? reason.message : '記録を保存できません。端末の空き容量や保存設定を確認して、もう一度お試しください。'); return false; }
    finally { if (alive.current) setBusy(false); }
  }
  function recordVisible(offset: number) {
    if (!ready || offset === reading.cursor) return;
    if (viewTimer.current) clearTimeout(viewTimer.current);
    viewTimer.current = setTimeout(() => {
      void store.save(state => ({ ...state, cursor: offset })).then(value => { if (alive.current) setReading(value); })
        .catch(() => { if (alive.current) setError('読書位置を保存できません。端末の保存設定を確認して、もう一度お試しください。'); });
    }, 250);
  }
  async function applyDisplay(value: DisplayPreferences) {
    try { const next = normalizePreferences(value); await AsyncStorage.setItem(preferenceKey, JSON.stringify(next)); setDisplay(next); return true; }
    catch { setError('表示設定を保存できません。端末の空き容量や保存設定を確認して、もう一度お試しください。'); return false; }
  }
  const shown = Math.min(Math.max(0, sub), subCount - 1);
  function next() {
    if (busy) return;
    if (shown < subCount - 1) setSub(shown + 1);
    else setRunning(false);
  }
  function prev() {
    if (busy) return;
    if (shown > 0) setSub(shown - 1);
  }
  function begin(id?: string) {
    setRunning(false);
    setMoving(id ?? `mark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    setDraft(null); setPanel(false); setNotice('');
  }
  async function dropMark(from: number, to: number | null) {
    const before = reading.marks.find(mark => mark.offset === from);
    if (!before || to === null) { setMoving(null); setDraft(null); return; }
    let after: Mark | undefined;
    if (await save(state => { const next = placeMark(state, book.text, to, before.id); after = next.marks.find(mark => mark.id === before.id); return next; })) {
      if (after) setUndo({ before, after }); setNotice('しおりを移動しました。');
    }
    setMoving(null); setDraft(null);
  }
  function resume(mark: Mark) {
    setRunning(false);
    setFocus({ offset: Math.max(0, mark.offset - 1), token: Date.now() }); setPanel(false);
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
  const target = reading.marks.find(mark => mark.id === selected);
  const range = target ? summaryRange(book.text, reading.marks, target.id, scope) : null;
  const sorted = [...reading.marks].sort((a, b) => b.updatedAt - a.updatedAt);
  // 紙面のしおりを押したら、そのしおりのふりかえりを開く
  function openMark(offset: number) {
    const mark = reading.marks.find(item => item.offset === offset);
    if (mark && !moving) { setRunning(false); setSelected(mark.id); setScope('previous'); setPanel(true); }
  }
  const paint = paperColors(display.paper);
  return <View style={[styles.screen, { backgroundColor: paint.background }]}>
    {/* ヘッダー：中央にタイトルと作者、右にしおりの操作 */}
    <Stack.Screen options={{
      headerTitleAlign: 'center',
      headerTitle: () => <View style={styles.headTitle}><Text style={styles.title}>{book.title}</Text><Text style={styles.small}>{book.author}</Text></View>,
      headerRight: () => <View style={styles.headRight}>
        <Action disabled={!ready || busy || !!moving} onPress={() => begin()}>しおりを挟む</Action>
        <Action disabled={!ready || busy || !!moving} onPress={() => { setRunning(false); setSelected(null); setPanel(true); }}>しおり一覧</Action>
      </View>,
    }} />
    {/* 読みガイドの操作は横1列。入りきらないときは横にスクロール */}
    <ScrollView horizontal style={styles.bar} contentContainerStyle={styles.barContent} showsHorizontalScrollIndicator={false}>
      <Action disabled={!displayReady || !!moving} onPress={() => { setRunning(false); setSettingsOpen(true); }}>Aa 表示設定</Action>
      <Action disabled={!ready || !!moving} onPress={() => { setRunning(false); setFeature('comic'); }}>紹介4コマ</Action>
      <Action disabled={!ready || !!moving} onPress={() => { setRunning(false); setFeature('characters'); }}>人物相関図</Action>
      <Action filled={guide} onPress={() => { setGuide(value => !value); setRunning(false); }}>{guide ? '読みガイド ON' : '読みガイド OFF'}</Action>
      {guide && <>
        <Action disabled={!ready || !!moving} onPress={() => setRunning(value => !value)}>{running ? '一時停止' : 'ガイドを開始'}</Action>
        {speeds.map(value => <Action key={value} filled={speed === value} onPress={() => setSpeed(value)}>{`${value}字/分`}</Action>)}
      </>}
    </ScrollView>
    {/* 紙面は画面いっぱい。左側を押すと次、右側を押すと前のページ */}
    <View style={[styles.paper, { backgroundColor: paint.background }]}>
      <VerticalPage
        text={book.text}
        start={0}
        sub={sub}
        marks={reading.marks.map(mark => mark.offset)}
        faded={reading.marks.find(mark => mark.id === moving)?.offset ?? null}
        picking={!!moving}
        draft={draft}
        guide={guide}
        running={running}
        speed={speed}
        display={display}
        paint={paint}
        disabled={!ready || !displayReady || busy || panel || settingsOpen || !!feature}
        focus={focus}
        onPick={offset => setDraft(offset)}
        onMarkPress={openMark}
        onPages={setSubCount}
        onReflow={setSub}
        onVisible={recordVisible}
        onNext={() => { setRunning(false); next(); }}
        onPrev={() => { setRunning(false); prev(); }}
        onAdvance={next}
        onPause={() => setRunning(false)}
        onDragStart={offset => { const mark = reading.marks.find(item => item.offset === offset); if (mark) begin(mark.id); }}
        onDrop={(from, to) => { void dropMark(from, to); }}
        dom={{ style: { flex: 1 } }}
      />
      {moving && <View style={styles.placement}><Text style={styles.note}>文字を押して選択。端で待つとページを移れます。</Text><View style={styles.toolbar}><Action disabled={busy || draft === null} filled onPress={() => void confirm()}>この位置に挟む</Action><Action disabled={busy} onPress={() => { setMoving(null); setDraft(null); }}>キャンセル</Action></View></View>}
      {(!!error || !!notice) && <View style={styles.feedback}>
        {!!error && <Text accessibilityRole="alert" style={styles.message}>{error}</Text>}
        {!!notice && <View style={styles.toolbar}><Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>{undo && <Action disabled={busy} onPress={() => void undoMove()}>元に戻す</Action>}<Action onPress={() => setNotice('')}>閉じる</Action></View>}
      </View>}
    </View>
    <Pressable accessibilityRole="link" style={styles.source} onPress={() => void Linking.openURL(book.cardUrl)}><Text style={styles.note}>出典：青空文庫</Text></Pressable>
    <PageBar page={shown} count={subCount} disabled={!ready || busy || !!moving} ink={paint.ink} accent={paint.accent} line={paint.chosen}
      onChange={value => { setRunning(false); setSub(value); }} />
    <Modal visible={panel} transparent animationType="slide" onRequestClose={() => setPanel(false)}>
      <View style={styles.overlay}><View style={styles.sheet}><View style={styles.toolbar}><Text style={styles.heading}>{target ? 'ふりかえり' : 'しおり'}</Text><Action onPress={() => setPanel(false)}>閉じる</Action></View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          {target && range ? <>
            <Action onPress={() => setSelected(null)}>‹ しおり一覧へ</Action>
            <View style={styles.toolbar}>{([{ id: 'previous', label: '前回から' }, { id: 'chapter', label: 'この章' }, { id: 'start', label: '最初から' }] as const).map(item => <Action key={item.id} filled={scope === item.id} onPress={() => setScope(item.id)}>{item.label}</Action>)}</View>
            <Summary key={`${target.id}:${target.updatedAt}:${scope}:${range.start}:${range.end}`} text={range.text} cacheKey={`dopabooks:summary:v1:${book.id}:${reading.source}:${range.start}:${range.end}`} />
            <View style={styles.toolbar}><Action disabled={busy} filled onPress={() => { resume(target); }}>ここから読む</Action><Action disabled={busy} onPress={() => begin(target.id)}>しおりを移動</Action><Action disabled={busy} onPress={() => { void save(state => removeMark(state, target.id)).then(ok => { if (ok) { setSelected(null); setUndo(null); } }); }}>外す</Action></View>
          </> : <>
            {!sorted.length && <Text style={styles.note}>しおりはまだありません。本文の文字を選んで挟めます。</Text>}
            {sorted.map((mark, index) => <View key={mark.id} style={styles.markCard}><Text style={styles.heading}>しおり {sorted.length - index}</Text><Text style={styles.note}>{book.text.slice(Math.max(0, mark.offset - 65), mark.offset) || '本文のはじまり'}</Text><View style={styles.toolbar}><Action onPress={() => { setSelected(mark.id); setScope('previous'); }}>ふりかえり</Action><Action disabled={busy} onPress={() => { resume(mark); }}>ここから読む</Action><Action disabled={busy} onPress={() => begin(mark.id)}>移動</Action><Action disabled={busy} onPress={() => { void save(state => removeMark(state, mark.id)).then(ok => { if (ok) setUndo(null); }); }}>外す</Action></View></View>)}
          </>}
        </ScrollView>
      </View></View>
    </Modal>
    {settingsOpen && <DisplaySettings value={display} close={() => setSettingsOpen(false)} apply={applyDisplay} />}
    <Modal visible={feature !== null} animationType="slide" onRequestClose={() => setFeature(null)}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}><View style={styles.toolbar}><Text style={styles.heading}>{feature === 'comic' ? '紹介4コマ' : '人物相関図'}</Text><Action onPress={() => setFeature(null)}>閉じる</Action></View>
        {feature === 'comic' && <IntroComic book={book} read={() => { setFocus({ offset: 0, token: Date.now() }); setFeature(null); }} />}
        {feature === 'characters' && <Characters text={book.text} marks={reading.marks} jump={offset => { setFocus({ offset, token: Date.now() }); setFeature(null); }} />}
      </SafeAreaView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 10 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface },
  buttonText: { color: colors.accent, fontSize: 14 }, filled: { backgroundColor: colors.accent }, light: { color: colors.surface }, disabled: { opacity: 0.4 },
  message: { color: colors.ink, backgroundColor: colors.surface, padding: 12, lineHeight: 24 }, note: { color: colors.muted, fontSize: 14, lineHeight: 24 },
  title: { color: colors.ink, fontSize: 17, letterSpacing: 3, fontFamily: 'serif' }, heading: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  paper: { flex: 1, marginHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surface },
  headTitle: { alignItems: 'center' }, small: { color: colors.muted, fontSize: 11, marginTop: 2 }, headRight: { flexDirection: 'row', gap: 8, marginRight: 8 },
  bar: { flexGrow: 0 }, barContent: { gap: 8, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5 },
  source: { alignSelf: 'center', paddingTop: 2 },
  feedback: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, zIndex: 20 },
  placement: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, padding: 4, zIndex: 20 },
  overlay: { flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 16 }, sheet: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, maxHeight: '95%', width: '100%', maxWidth: 720, alignSelf: 'center' },
  sheetContent: { padding: 16, gap: 20 }, markCard: { gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line },
});
