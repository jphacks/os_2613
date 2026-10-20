import { domBootstrap } from '@/features/reader/dom-bootstrap.mjs';
import { FeatureToggle } from '@/shared/FeatureToggle';
import { ReaderPanel, usePhoneReaderPanel } from '@/shared/ReaderPanel';
import { ReviewLayer } from '@/features/reviews/ReviewLayer';
import { StudyToolsContext } from '@/features/study/StudyToolPanel';
import { useContext } from 'react';
import { AppIcon } from '@/shared/AppIcon';
import { Image } from 'expo-image';
import { GuideSpeed } from '@/features/reader/GuideSpeed';
import { useAccount } from '@/features/account/AccountProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { router, Stack } from 'expo-router';
import { Alert, AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { SavedBook } from '@/features/library/types';
import { colors } from '@/shared/theme';
import { readerToolButton, readerToolSymbol, readerPanelTitle, readerPanelHeader } from '@/features/reader/toolStyles';
import { bindGuideKeyboard } from '@/features/reader/guide-keyboard.mjs';
import { createReadingStore, documentVersion, emptyReading, placeMark, removeMark, summaryRange, type Mark, type Reading, type Scope } from './model.mjs';
import { Summary } from './Summary';
import { BookmarkHandle, type BookmarkDragPoint } from './BookmarkHandle';
import VerticalPage from '@/features/reader/VerticalPage';
import HorizontalStudyPage from '@/features/study/HorizontalStudyPage';
import { MusicPanel } from '@/features/music/MusicPanel';
import { DisplaySettings, paperColors, Slider } from '@/features/reader/DisplaySettings';
import { PageBar } from '@/features/reader/PageBar';
import { IntroComic } from '@/features/comic/IntroComic';
import { Characters } from '@/features/characters/Characters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rememberWidgetBook } from '@/features/widget/bookmarks';
import { summarizeForWidget } from '@/features/widget/summary';
import { recordFinished, recordReading } from '@/features/stats/stats';
import { openFocusSettings } from '@/features/focus/openFocusSettings';
import { defaultPreferences, normalizePreferences, preferenceKey, type DisplayPreferences } from '@/features/reader/preferences.mjs';

// 読みガイドの速さ（1分あたりの文字数）の選択肢


function Action({ children, onPress, disabled = false, filled = false, compact = false, danger = false }: { danger?: boolean; children: string; compact?: boolean; onPress: () => void; disabled?: boolean; filled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, compact && styles.compactAction, filled && styles.filled, danger && { backgroundColor: colors.dangerBackground }, disabled && styles.disabled]}><Text style={[styles.buttonText, compact && styles.compactActionText, filled && styles.light, danger && { color: colors.danger }]} numberOfLines={compact ? 1 : undefined}>{children}</Text></Pressable>;
}

function BookmarkIcon({ color = colors.accent }: { color?: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 28"><path d="M3 1h14a2 2 0 0 1 2 2v24l-9-6-9 6V3a2 2 0 0 1 2-2Z" fill="${color}"/></svg>`;
  return <Image source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ width: 20, height: 28 }} contentFit="contain" />;
}

export function BookReading({ book, initialOffset, study = false, sourceLabel = '青空文庫', trackingId = book.id, studyVisuals, studyScrollTarget, onStudyPosition, onStudyDisplayControl, onReady, onLoadError, hideBookmark = false }: { book: SavedBook; initialOffset?: number; study?: boolean; sourceLabel?: string; trackingId?: string; studyVisuals?: import('../study/visuals.mjs').StudyVisual[]; studyScrollTarget?: { offset: number; token: number } | null; onStudyPosition?: (offset: number) => void; onStudyDisplayControl?: (control: ReactNode | null) => void; onReady?: () => void; onLoadError?: (message: string) => void; hideBookmark?: boolean }) {
  const phoneSheet = usePhoneReaderPanel();
  const ReadingPage = study ? HorizontalStudyPage : VerticalPage;
  const { identity, prefs, complete } = useAccount();
  const store = useMemo(() => createReadingStore(AsyncStorage, `dopabooks:reading:v1:${book.id}${study ? `:${documentVersion(book.text)}` : ''}`, book.text), [book.id, book.text, study]);
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
  const [readPosition, setReadPosition] = useState(0);
  const [guide, setGuide] = useState(false);
  const [running, setRunning] = useState(false);
  // 読書クエスト「本を読む」：小説を開いたら完了
  useEffect(() => { complete('read'); }, []);
  const [speed, setSpeed] = useState(1200);
  const [guideLift, setGuideLift] = useState(1);
  useEffect(() => { let active = true; void AsyncStorage.getItem(`dopabooks:guide-lift:v1:${identity?.did || 'guest'}`).then(raw => { if (active) setGuideLift(raw !== null && Number.isFinite(Number(raw)) ? Math.max(0, Math.min(1, Number(raw))) : 1); }).catch(() => {}); return () => { active = false; }; }, [identity?.did]);
  function changeLift(value: number) { setGuideLift(value); void AsyncStorage.setItem(`dopabooks:guide-lift:v1:${identity?.did || 'guest'}`, String(value)).catch(() => {}); }
  const [speedReady, setSpeedReady] = useState(false);
  const speedKey = `dopabooks:guide-speed:v1:${identity?.did || 'guest'}`;
  useEffect(() => { let active = true; setSpeedReady(false); void AsyncStorage.getItem(speedKey).then(raw => { if (active) setSpeed(raw && Number.isFinite(Number(raw)) ? Math.max(120, Math.min(3000, Number(raw))) : 1200); }).catch(() => {}).finally(() => { if (active) setSpeedReady(true); }); return () => { active = false; }; }, [speedKey]);
  useEffect(() => { if (!speedReady) return; const timer = setTimeout(() => { void AsyncStorage.setItem(speedKey, String(speed)).catch(() => {}); }, 300); return () => clearTimeout(timer); }, [speed, speedReady, speedKey]);
  const [sub, setSub] = useState(0);
  const [subCount, setSubCount] = useState(1);
  const [paginatedText, setPaginatedText] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [display, setDisplay] = useState<DisplayPreferences>({ ...defaultPreferences });
  const [displayReady, setDisplayReady] = useState(false);
  useEffect(() => { if (!ready && error) onLoadError?.(error); }, [ready, error, onLoadError]);
  const studyTools = useContext(StudyToolsContext);
  const selectStudyTool = studyTools?.select;
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
  const settingsOpen = study && studyTools ? studyTools.active === 'display' : localSettingsOpen;
  const setSettingsOpen = (open: boolean) => study && studyTools ? studyTools.select(open ? 'display' : null) : setLocalSettingsOpen(open);
  const studyDisplayControl = useMemo(() => <Pressable accessibilityRole="button" accessibilityLabel="表示設定" disabled={!displayReady} onPress={() => { setMenu(false); setMusicOpen(false); setSettingsOpen(true); }} style={[styles.toolIcon, !displayReady && styles.disabled]}><Text style={{ fontSize: 24, lineHeight: 28, fontWeight: '600', color: colors.accent }}>Aa</Text></Pressable>, [displayReady, selectStudyTool, study]);
  const [musicOpen, setMusicOpen] = useState(false);
  const [toolsHeight, setToolsHeight] = useState(48);
  function toggleGuide() { if (!guide) setGuide(true); setRunning(!guide || !running); }
  const [feature, setFeature] = useState<'comic' | 'characters' | null>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (study || Platform.OS !== 'web') return;
    return bindGuideKeyboard(document, () => !ready || !displayReady || busy || moving || panel || settingsOpen || feature || menu || musicOpen ? undefined : toggleGuide);
  }, [study, ready, displayReady, busy, moving, panel, settingsOpen, feature, menu, musicOpen, guide, running]);
  const [focus, setFocus] = useState<{ offset: number; token: number } | null>(null);
  const [headerDrag, setHeaderDrag] = useState<{ token: number; x: number; y: number; phase: 'move' | 'end' | 'cancel' } | null>(null);
  const [dragIcon, setDragIcon] = useState<{ x: number; y: number } | null>(null);
  const screenRef = useRef<ComponentRef<typeof View>>(null), paperRef = useRef<ComponentRef<typeof View>>(null);
  const [paperSize, setPaperSize] = useState({ width: 0, height: 0 });
  const dragToken = useRef<number | null>(null), dragSequence = useRef(0);
  const dragPoint = useRef<BookmarkDragPoint | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const insets = useSafeAreaInsets();
  // 初めて本を開いたときに1回だけ、マイクの許可を求めるときのようなダイアログで「読書集中モード」を案内する。
  // iOS ではアプリから集中モードをオンにできないので、設定アプリへ案内する。
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const key = 'dopabooks:focus-asked:v1';
    void AsyncStorage.getItem(key).then(asked => {
      if (asked) return;
      void AsyncStorage.setItem(key, '1');
      Alert.alert(
        '「ドパBOOKs」で読書集中モードを使いますか？',
        '読んでいる間の通知を止めるには、設定の「集中モード」で読書用のモードを作り、「自動的にオン」にドパBOOKsを選んでください。',
        [
          { text: '今はしない', style: 'cancel' },
          { text: '設定方法を見る', onPress: () => router.push('/focus') },
          { text: '設定を開く', style: 'default', onPress: openFocusSettings },
        ],
      );
    }).catch(() => {});
  }, []);
  // 読書時間を記録する（分析画面用）。画面を開いている間を数え、アプリを離れた時と画面を閉じた時に保存する。
  useEffect(() => {
    let since: number | null = Date.now();
    const flush = () => { if (since !== null) { void recordReading(trackingId, (Date.now() - since) / 1000); since = null; } };
    const sub = AppState.addEventListener('change', state => { if (state === 'active') since = Date.now(); else flush(); });
    return () => { sub.remove(); flush(); };
  }, [trackingId]);
  // ウィジェットには「最後に読んだ位置」を渡す（しおりを動かしても、この位置は変わらない）
  useEffect(() => {
    if (!ready || study || reading.cursor <= 0) return;
    void rememberWidgetBook({
      bookId: book.id, title: book.title, author: book.author, offset: reading.cursor,
      excerpt: book.text.slice(Math.max(0, reading.cursor - 60), reading.cursor).replace(/\s+/g, ' ').trim(),
      progress: Math.round((reading.cursor / Math.max(1, book.text.length)) * 100),
      updatedAt: Date.now(),
    });
  }, [ready, reading.cursor, book, study]);
  // 本を閉じたとき・アプリを離れたときに、「1つ前のしおり」から「最後に読んだ位置」までを自動で要約して
  // ウィジェットに渡す。まだ読んでいない部分は含めない。読み進めた量が少ないときは作らない（API の利用料を抑える）。
  const latestForSummary = useRef({ cursor: 0, marks: reading.marks });
  latestForSummary.current = { cursor: reading.cursor, marks: reading.marks };
  useEffect(() => {
    if (study) return;
    const summarize = () => { void summarizeForWidget(book, latestForSummary.current.cursor, latestForSummary.current.marks.map(mark => mark.offset)); };
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') summarize(); });
    return () => { sub.remove(); summarize(); };
  }, [book, study]);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(preferenceKey).then(raw => { if (active && raw) setDisplay(normalizePreferences(JSON.parse(raw))); })
      .catch(() => { if (active) setError('表示設定を読み込めません。端末の保存設定を確認してください。標準の表示で開いています。'); })
      .finally(() => { if (active) setDisplayReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    alive.current = true;
    if (study) { setReading(emptyReading(book.text)); setFocus({ offset: 0, token: Date.now() }); setReady(true); return () => { alive.current = false; }; }
    void store.load().then(value => { if (alive.current) { setReading(value); setFocus({ offset: initialOffset ?? value.cursor, token: Date.now() }); setReady(true); } })
      .catch(() => { if (alive.current) setError('読書記録を読み込めません。端末の保存設定や本文の変更を確認し、本を開き直してください。記録は上書きしていません。'); });
    return () => { alive.current = false; if (viewTimer.current) clearTimeout(viewTimer.current); };
  }, [store, initialOffset, study]);
  useEffect(() => {
    if (study && studyScrollTarget) setFocus({ offset: studyScrollTarget.offset, token: studyScrollTarget.token });
  }, [study, studyScrollTarget]);
  useEffect(() => {
    if (!study || !onStudyDisplayControl) return;
    onStudyDisplayControl(studyDisplayControl);
    return () => onStudyDisplayControl(null);
  }, [study, onStudyDisplayControl, studyDisplayControl]);

  async function save(change: (state: Reading) => Reading) {
    if (!ready || busy) return false;
    setBusy(true); setError('');
    try { const value = await store.save(change); if (alive.current) setReading(value); return true; }
    catch (reason) { if (alive.current) setError(reason instanceof Error && reason.message.includes('してください') ? reason.message : '記録を保存できません。端末の空き容量や保存設定を確認して、もう一度お試しください。'); return false; }
    finally { if (alive.current) setBusy(false); }
  }
  function recordVisible(offset: number) {
    if (study) { onStudyPosition?.(offset); return; }
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
  // 本文の最終ページではまだ読了にせず、その次の終了画面へ進んだ時に記録する。
  useEffect(() => {
    if (!ending || study || !ready) return;
    void recordFinished(book.id);
    if (viewTimer.current) clearTimeout(viewTimer.current);
    void store.save(state => ({ ...state, cursor: book.text.length })).then(value => { if (alive.current) setReading(value); }).catch(() => setError('読書位置を保存できません。端末の保存設定を確認してください。'));
  }, [ending, study, ready, book.id, store]);
  function next() {
    if (busy || ending) return;
    if (shown < subCount - 1) setSub(shown + 1);
    else { setRunning(false); if (!study && !moving) { setMenu(false); setMusicOpen(false); setEnding(true); } }
  }
  function prev() {
    if (busy) return;
    if (ending) { setEnding(false); setSub(subCount - 1); setFocus({ offset: Math.max(0, book.text.length - 1), token: Date.now() }); return; }
    if (shown > 0) setSub(shown - 1);
  }
  function begin(id?: string) {
    setRunning(false);
    setMoving(id ?? `mark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    setDraft(null); setPanel(false); setNotice('');
  }
  function dragFromHeader(point: BookmarkDragPoint) {
    if (!ready || busy || moving) return;
    if (dragToken.current === null) {
      if (point.phase !== 'move') return;
      dragToken.current = ++dragSequence.current;
      setRunning(false); setNotice('');
    }
    const token = dragToken.current; dragPoint.current = point;
    if (point.phase === 'cancel') { setHeaderDrag({ token, x: 0, y: 0, phase: 'cancel' }); setDragIcon(null); return; }
    screenRef.current?.measureInWindow((left, top) => {
      if (dragToken.current !== token || dragPoint.current !== point) return;
      setDragIcon(point.phase === 'move' ? { x: point.x - left, y: point.y - top } : null);
    });
    paperRef.current?.measureInWindow((left, top, width, height) => {
      if (dragToken.current !== token || dragPoint.current !== point || width <= 0 || height <= 0) return;
      // DOM紙面がWebView内でも、画面座標を相対座標にして受け渡す。
      setHeaderDrag({ token, x: (point.x - left) / width, y: (point.y - top) / height, phase: point.phase });
    });
  }
  async function dropFromHeader(token: number, offset: number | null) {
    if (dragToken.current !== token) return;
    dragToken.current = null; dragPoint.current = null; setHeaderDrag(null); setDragIcon(null);
    if (offset === null) return;
    const id = `mark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    if (await save(state => placeMark(state, book.text, offset, id))) { setUndo(null); setNotice(''); }
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
  async function confirm(offset = draft) {
    if (!moving || offset === null) return;
    const before = reading.marks.find(mark => mark.id === moving);
    let after: Mark | undefined;
    if (await save(state => { const next = placeMark(state, book.text, offset, moving); after = next.marks.find(mark => mark.id === moving); return next; })) {
      if (before && after) setUndo({ before, after }); else setUndo(null);
      setMoving(null); setDraft(null); setNotice(before ? 'しおりを移動しました。' : '');
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
  const bookmarkActions = useRef({ onDrag: dragFromHeader, onPlace: () => begin() });
  bookmarkActions.current = { onDrag: dragFromHeader, onPlace: () => begin() };
  // ドラッグ位置の更新ごとにヘッダーボタンを作り直すと、ポインター捕捉が失われる。
  const bookmarkHeader = useMemo(() => () => hideBookmark || feature === 'comic' ? null : <View style={styles.headRight}>
    {study ? null : <BookmarkHandle disabled={!ready || busy || !!moving}
      onOpen={() => { setRunning(false); setSelected(null); setPanel(true); }}
      onPlace={() => bookmarkActions.current.onPlace()} onDrag={point => bookmarkActions.current.onDrag(point)}>
      <BookmarkIcon />
    </BookmarkHandle>}
  </View>, [hideBookmark, feature, study, ready, busy, moving]);
  const paint = paperColors(display);
  return <View ref={screenRef} collapsable={false} style={styles.screen}>
    {/* ヘッダー：中央にタイトルと作者、右にメニュー */}
    <Stack.Screen options={{
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: colors.paper },
      headerTintColor: study ? colors.surface : colors.accent,
      headerTitle: () => <View style={styles.headTitle}><Text style={styles.title}>{book.title}</Text><Text style={styles.small}>{book.author}</Text></View>,
      // iPhone ではヘッダーのボタンに標準の枠が付くので、こちらでは枠を付けない（枠が二重になるため）
      headerRight: bookmarkHeader,
    }} />
    {!study && <View style={styles.topTools} onLayout={event => setToolsHeight(event.nativeEvent.layout.height)}>
      <View style={styles.studyToolRow}>
        <View style={styles.directTools}>
          {studyDisplayControl}

        </View>
        <MusicPanel detailsOpen={musicOpen} onGuidePress={() => { setMusicOpen(false); setMenu(true); }} onDetailsChange={open => { if (open) setMenu(false); setMusicOpen(open); }} visible={!study && prefs.music} book={book} position={readPosition} guideEnabled={guide} guideActive={!ending && guide && running && !moving && !panel && !settingsOpen && !feature} />
        {!study && <Pressable accessibilityRole="button" accessibilityLabel="読みガイドの設定を開く" accessibilityState={{ expanded: menu }} onPress={() => { setMusicOpen(false); setMenu(!menu); }} style={styles.toolIcon}><AppIcon name="waves" size={24} /></Pressable>}
        {!study && <Pressable accessibilityRole="button" accessibilityLabel={guide && running ? 'ガイドを停止' : 'ガイド開始'} disabled={!ready || !!moving || busy || ending} onPress={toggleGuide} style={styles.guideStart}><Text style={styles.buttonText}>{guide && running ? '■ 停止' : '▶ 開始'}</Text></Pressable>}
      {moving && <View style={styles.placement}><Action disabled={busy || draft === null} filled onPress={() => void confirm()}>この位置に挟む</Action><Action disabled={busy} onPress={() => { setMoving(null); setDraft(null); }}>キャンセル</Action></View>}
      </View>
    </View>}
      {study && moving && <View style={styles.placement}><Action disabled={busy || draft === null} filled onPress={() => void confirm()}>この位置に挟む</Action><Action disabled={busy} onPress={() => { setMoving(null); setDraft(null); }}>キャンセル</Action></View>}
    {/* 読みガイドがONのときだけ、開始・停止をすぐ押せる所に出す。細かい設定はメニューの中 */}
    {/* 漫画・表示設定・読みガイドはメニューから開く。しおりは上部から直接操作する。 */}
    {!study && <ReaderPanel visible={menu} label="読みガイド" onClose={() => setMenu(false)} desktop={menu && !study && <View pointerEvents="box-none" style={[styles.menuBack, { top: toolsHeight + 8, bottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={styles.menu} onPress={() => {}}><ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
          <View style={[readerPanelHeader, { marginHorizontal: -12 }]}><Text style={readerPanelTitle}>読みガイド</Text></View>
          <View accessibilityRole="tablist" style={styles.guideToggle}>{[true, false].map(on => <Pressable key={String(on)} accessibilityRole="tab" accessibilityLabel={`読みガイド ${on ? 'ON' : 'OFF'}`} accessibilityState={{ selected: guide === on }} onPress={() => { setGuide(on); if (!on) setRunning(false); }} style={[styles.guideOption, guide === on && { backgroundColor: colors.accent }]}><Text style={[styles.guideLabel, guide === on && { color: colors.surface }]}>{on ? 'ON' : 'OFF'}</Text></Pressable>)}</View>
          {guide ? <><GuideSpeed value={speed} onChange={setSpeed} /><Text style={styles.guideLabel}>浮き上がり</Text><Slider value={guideLift} min={0} max={1} step={0.1} showValue={false} format={value => `${Math.round(value * 100)}%`} onChange={changeLift} /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={styles.guideEndpoint}>0%</Text><Text style={styles.guideEndpoint}>100%</Text></View></> : <Text style={styles.note}>読みガイドがOFFの間は、連動する世界観BGMもOFFになります。</Text>}
          </ScrollView>
        </Pressable>
      </View>}><ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
          <View style={[readerPanelHeader, { marginHorizontal: -12 }]}><Text style={readerPanelTitle}>読みガイド</Text></View>
          <View accessibilityRole="tablist" style={styles.guideToggle}>{[true, false].map(on => <Pressable key={String(on)} accessibilityRole="tab" accessibilityLabel={`読みガイド ${on ? 'ON' : 'OFF'}`} accessibilityState={{ selected: guide === on }} onPress={() => { setGuide(on); if (!on) setRunning(false); }} style={[styles.guideOption, guide === on && { backgroundColor: colors.accent }]}><Text style={[styles.guideLabel, guide === on && { color: colors.surface }]}>{on ? 'ON' : 'OFF'}</Text></Pressable>)}</View>
          {guide ? <><GuideSpeed value={speed} onChange={setSpeed} /><Text style={styles.guideLabel}>浮き上がり</Text><Slider value={guideLift} min={0} max={1} step={0.1} showValue={false} format={value => `${Math.round(value * 100)}%`} onChange={changeLift} /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={styles.guideEndpoint}>0%</Text><Text style={styles.guideEndpoint}>100%</Text></View></> : <Text style={styles.note}>読みガイドがOFFの間は、連動する世界観BGMもOFFになります。</Text>}
          </ScrollView></ReaderPanel>}
    {/* 紙面は画面いっぱい。左側を押すと次、右側を押すと前のページ */}
<View ref={paperRef} collapsable={false} onLayout={event => { const { width, height } = event.nativeEvent.layout; setPaperSize(before => before.width === width && before.height === height ? before : { width, height }); }} style={[styles.paper, { backgroundColor: paint.background }]} >
      <View style={StyleSheet.absoluteFill}>
      {(Platform.OS === 'web' || paperSize.height > 0) && <ReadingPage

        viewportSize={Platform.OS === 'web' ? undefined : paperSize}
        onReady={onReady}
        onLoadError={onLoadError}
        visuals={studyVisuals}
        text={Platform.OS === 'web' ? book.text : encodeURIComponent(book.text)}
        textEncoded={Platform.OS !== 'web'}
        start={0}
        sub={ending && !study ? subCount : sub}
        marks={reading.marks.map(mark => mark.offset)}
        faded={reading.marks.find(mark => mark.id === moving)?.offset ?? null}
        picking={!!moving}
        draft={draft}
        guide={study ? false : guide}
        running={study ? false : running}
        speed={speed}
        guideLift={guideLift}
        display={display}
        paint={paint}
        disabled={!ready || !displayReady || busy || panel || settingsOpen || reviewOpen || !!feature}
        focus={focus}
        onPick={offset => { setDraft(offset); void confirm(offset); }}
        onMarkPress={openMark}
        bookTitle={book.title}
        onOpenReview={study ? undefined : () => setReviewOpen(true)}
        onFinish={study ? undefined : () => { if (!moving && !busy) { setRunning(false); setMusicOpen(false); setMenu(false); setEnding(true); } }}
        onPages={count => { setSubCount(count); setPaginatedText(book.text); }}
        onReflow={page => { setSub(page); setEnding(false); }}
        onVisible={recordVisible}
        onPosition={setReadPosition}
        onNext={() => { if (!busy) { next(); if (guide && running && !moving && shown < subCount - 1) setRunning(true); } }}
        onPrev={() => { if (!busy && (ending || shown > 0)) { prev(); if (guide && running && !moving) setRunning(true); } }}
        onAdvance={next}
        onPause={() => setRunning(false)}
        onToggleGuide={!study && !menu && !musicOpen ? toggleGuide : undefined}
        onDragStart={offset => { const mark = reading.marks.find(item => item.offset === offset); if (mark) begin(mark.id); }}
        onDrop={(from, to) => { void dropMark(from, to); }}
        headerDrag={headerDrag}
        onHeaderDrop={(token, offset) => { void dropFromHeader(token, offset); }}
        dom={{ useExpoDOMWebView: false, injectedJavaScriptBeforeContentLoaded: __DEV__ ? domBootstrap : undefined, contentInsetAdjustmentBehavior: 'never', style: Platform.OS === 'web' ? { flex: 1 } : { width: paperSize.width, height: paperSize.height }, containerStyle: { flex: 1 }, bounces: false, overScrollMode: 'never', directionalLockEnabled: true, onError: () => onLoadError?.('本文画面を読み込めませんでした。接続を確認して、もう一度お試しください。'), onContentProcessDidTerminate: () => onLoadError?.('本文画面の処理が停止しました。もう一度お試しください。') }}
      />}
      </View>
      {(!!error || !!notice) && <View style={styles.feedback}>
        {!!error && <Text accessibilityRole="alert" style={styles.message}>{error}</Text>}
        {!!notice && <View style={styles.toolbar}><Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>{undo && <Action disabled={busy} onPress={() => void undoMove()}>元に戻す</Action>}<Action onPress={() => setNotice('')}>閉じる</Action></View>}
      </View>}
    </View>
    {dragIcon && <View pointerEvents="none" style={{ position: 'absolute', left: dragIcon.x - 9, top: dragIcon.y - 5, zIndex: 100 }}><BookmarkIcon /></View>}
    {/* ページバーを上、出典を下にする。iPhone の画面下の線（ホームバー）と重ならないよう、その分の余白を空ける */}
    <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
      {/* 仮の1ページ＋読了ページを見せない。高さは確保して紙面の再計測を防ぐ。 */}
      {!study && <View pointerEvents={paginatedText === book.text ? 'auto' : 'none'} aria-hidden={paginatedText !== book.text} accessibilityElementsHidden={paginatedText !== book.text} style={{ opacity: paginatedText === book.text ? 1 : 0 }}><PageBar page={ending ? subCount : shown} count={subCount + 1} disabled={!ready || busy || !!moving} ink={colors.ink} accent={colors.accent} line={colors.line}
        onChange={value => { setEnding(value === subCount); setSub(Math.min(value, subCount - 1)); if (guide && running && !moving && value < subCount) setRunning(true); else setRunning(false); }} /></View>}
      {!study && <Pressable accessibilityRole="link" style={styles.source} onPress={() => void Linking.openURL(book.cardUrl)}><Text style={styles.note}>出典：{sourceLabel}</Text></Pressable>}
    </View>
    {reviewOpen && <ReviewLayer bookId={book.id} close={() => setReviewOpen(false)} />}
    <ReaderPanel visible={panel} label="しおり" onClose={() => setPanel(false)} desktop={<Modal visible={panel} transparent animationType="fade" onRequestClose={() => setPanel(false)}>
      <View style={styles.markOverlay}><View style={styles.markSheet}>{!phoneSheet && <View style={{ alignSelf: 'flex-start', paddingHorizontal: 16 }}><Pressable accessibilityRole="button" accessibilityLabel="しおりを閉じる" onPress={() => setPanel(false)} style={styles.toolIcon}><Text style={styles.waveIcon}>‹</Text></Pressable></View>}<View style={styles.toolbar}><Text style={styles.heading}>{target ? 'ふりかえり' : 'しおり'}</Text></View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <View style={styles.bookmarkActions}>
            {!study && prefs.comic && <Action compact onPress={() => { setPanel(false); setFeature('comic'); }}>紹介4コマ</Action>}
            {!study && prefs.characters && <Action compact onPress={() => { setPanel(false); setFeature('characters'); }}>人物相関図</Action>}
            {!target && <Action compact disabled={!ready || busy} onPress={() => begin()}>しおりを挟む</Action>}
          </View>
          {target && range ? <>
            <Action onPress={() => setSelected(null)}>‹ しおり一覧へ</Action>
            <View style={styles.toolbar}>{([{ id: 'previous', label: '前回から' }, { id: 'chapter', label: 'この章' }, { id: 'start', label: '最初から' }] as const).map(item => <Action key={item.id} filled={scope === item.id} onPress={() => setScope(item.id)}>{item.label}</Action>)}</View>
            <Summary key={`${target.id}:${target.updatedAt}:${scope}:${range.start}:${range.end}`} text={range.text} cacheKey={`dopabooks:summary:v1:${book.id}:${reading.source}:${range.start}:${range.end}`}
 />
            <View style={styles.toolbar}><Action disabled={busy} filled onPress={() => { resume(target); }}>ここから読む</Action><Action disabled={busy} onPress={() => begin(target.id)}>しおりを移動</Action><Action danger disabled={busy} onPress={() => { void save(state => removeMark(state, target.id)).then(ok => { if (ok) { setSelected(null); setUndo(null); } }); }}>外す</Action></View>
          </> : <>
            {!sorted.length && <Text style={styles.note}>しおりはまだありません。本文の文字を選んで挟めます。</Text>}
            {sorted.map((mark, index) => <View key={mark.id} style={styles.markCard}><Text style={styles.heading}>しおり {sorted.length - index}</Text><Text style={styles.note}>{book.text.slice(Math.max(0, mark.offset - 65), mark.offset) || '本文のはじまり'}</Text><View style={styles.toolbar}><Action onPress={() => { setSelected(mark.id); setScope('previous'); }}>ふりかえり</Action><Action disabled={busy} onPress={() => { resume(mark); }}>ここから読む</Action><Action disabled={busy} onPress={() => begin(mark.id)}>移動</Action><Action danger disabled={busy} onPress={() => { void save(state => removeMark(state, mark.id)).then(ok => { if (ok) setUndo(null); }); }}>外す</Action></View></View>)}
          </>}
        </ScrollView>
      </View></View>
    </Modal>}>{!phoneSheet && <View style={{ alignSelf: 'flex-start', paddingHorizontal: 16 }}><Pressable accessibilityRole="button" accessibilityLabel="しおりを閉じる" onPress={() => setPanel(false)} style={styles.toolIcon}><Text style={styles.waveIcon}>‹</Text></Pressable></View>}<View style={styles.toolbar}><Text style={styles.heading}>{target ? 'ふりかえり' : 'しおり'}</Text></View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <View style={styles.bookmarkActions}>
            {!study && prefs.comic && <Action compact onPress={() => { setPanel(false); setFeature('comic'); }}>紹介4コマ</Action>}
            {!study && prefs.characters && <Action compact onPress={() => { setPanel(false); setFeature('characters'); }}>人物相関図</Action>}
            {!target && <Action compact disabled={!ready || busy} onPress={() => begin()}>しおりを挟む</Action>}
          </View>
          {target && range ? <>
            <Action onPress={() => setSelected(null)}>‹ しおり一覧へ</Action>
            <View style={styles.toolbar}>{([{ id: 'previous', label: '前回から' }, { id: 'chapter', label: 'この章' }, { id: 'start', label: '最初から' }] as const).map(item => <Action key={item.id} filled={scope === item.id} onPress={() => setScope(item.id)}>{item.label}</Action>)}</View>
            <Summary key={`${target.id}:${target.updatedAt}:${scope}:${range.start}:${range.end}`} text={range.text} cacheKey={`dopabooks:summary:v1:${book.id}:${reading.source}:${range.start}:${range.end}`}
 />
            <View style={styles.toolbar}><Action disabled={busy} filled onPress={() => { resume(target); }}>ここから読む</Action><Action disabled={busy} onPress={() => begin(target.id)}>しおりを移動</Action><Action danger disabled={busy} onPress={() => { void save(state => removeMark(state, target.id)).then(ok => { if (ok) { setSelected(null); setUndo(null); } }); }}>外す</Action></View>
          </> : <>
            {!sorted.length && <Text style={styles.note}>しおりはまだありません。本文の文字を選んで挟めます。</Text>}
            {sorted.map((mark, index) => <View key={mark.id} style={styles.markCard}><Text style={styles.heading}>しおり {sorted.length - index}</Text><Text style={styles.note}>{book.text.slice(Math.max(0, mark.offset - 65), mark.offset) || '本文のはじまり'}</Text><View style={styles.toolbar}><Action onPress={() => { setSelected(mark.id); setScope('previous'); }}>ふりかえり</Action><Action disabled={busy} onPress={() => { resume(mark); }}>ここから読む</Action><Action disabled={busy} onPress={() => begin(mark.id)}>移動</Action><Action danger disabled={busy} onPress={() => { void save(state => removeMark(state, mark.id)).then(ok => { if (ok) setUndo(null); }); }}>外す</Action></View></View>)}
          </>}
        </ScrollView>
      </ReaderPanel>
    {settingsOpen && <DisplaySettings value={display} onPreview={setDisplay} close={() => setSettingsOpen(false)} apply={applyDisplay} />}
    <Modal visible={feature !== null} animationType="slide" onRequestClose={() => setFeature(null)}>
      {/* 全画面モーダルは読書画面とは別の座標系で安全領域を計測する。 */}
      <SafeAreaProvider style={styles.screen}>
      {feature !== null && <StatusBar style="dark" />}
      <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}><View style={styles.featureHeader}><Text style={styles.heading}>{feature === 'comic' ? '紹介4コマ' : '人物相関図'}</Text><Action onPress={() => setFeature(null)}>閉じる</Action></View>
        {feature === 'comic' && <IntroComic book={book} />}
        {feature === 'characters' && <Characters text={book.text} marks={reading.marks} jump={offset => { setFocus({ offset, token: Date.now() }); setFeature(null); }} />}
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  featureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  screen: { flex: 1, backgroundColor: colors.paper }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 10 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.button },
  waveIcon: readerToolSymbol,
  buttonText: { color: colors.accent, fontSize: 16, fontWeight: '700' }, filled: { backgroundColor: colors.accent }, light: { color: colors.surface }, disabled: { opacity: 0.4 },
  message: { color: colors.ink, backgroundColor: colors.surface, padding: 12, lineHeight: 24 }, note: { color: colors.muted, fontSize: 14, lineHeight: 24 },
  title: { color: colors.ink, fontSize: 17, letterSpacing: 3, fontFamily: 'serif' }, studyHeaderTitle: { color: colors.surface }, studyHeaderSmall: { color: colors.surface }, heading: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  paper: { flex: 1, marginHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surface },
  headTitle: { alignItems: 'center' }, small: { color: colors.muted, fontSize: 11, marginTop: 2 }, headRight: { flexDirection: 'row', alignItems: 'center' }, headButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { color: colors.accent, fontSize: 22 }, bookmarkIcon: { width: 18, height: 26 }, bookmarkBody: { width: 18, height: 18, backgroundColor: colors.accent, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  bookmarkTail: { flexDirection: 'row' }, bookmarkLeft: { width: 0, height: 0, borderLeftWidth: 9, borderLeftColor: colors.accent, borderBottomWidth: 8, borderBottomColor: 'transparent' }, bookmarkRight: { width: 0, height: 0, borderRightWidth: 9, borderRightColor: colors.accent, borderBottomWidth: 8, borderBottomColor: 'transparent' },
  guideLabel: { color: colors.ink, fontSize: 13, fontWeight: '400' }, guideEndpoint: { color: colors.muted, fontSize: 11 }, guideToggle: { flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: colors.button }, guideOption: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  guideGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.button, borderRadius: 999, overflow: 'hidden' }, guideStart: { width: 84, marginLeft: 'auto', marginRight: 12, alignItems: 'center', backgroundColor: colors.button, borderRadius: 999, paddingHorizontal: 8, minHeight: 40, justifyContent: 'center' }, guideSettings: { width: 36, minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  bookmarkActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactAction: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  compactActionText: { fontSize: 12 },
  toolbarTight: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  directTools: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 }, toolIcon: readerToolButton,
  topTools: { paddingLeft: 12, zIndex: 40 }, studyToolRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 46 }, studyInfo: { flex: 1, minWidth: 0, marginLeft: 8, color: colors.muted, fontSize: 12 }, toolsButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  menuBack: { position: 'absolute', top: 48, bottom: 12, left: 12, right: 12, zIndex: 45, backgroundColor: 'transparent', alignItems: 'flex-start' },
  menu: { width: 280, maxWidth: '85%', maxHeight: '65%', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, boxShadow: '0 2px 8px rgba(41,46,41,0.07)' },
  menuHead: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 4 },
  source: { alignSelf: 'center', paddingTop: 2 },
  feedback: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, zIndex: 20 },
  placement: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingVertical: 4 },
  markOverlay: { flex: 1, backgroundColor: 'rgba(41,46,41,0.18)', alignItems: 'flex-end' }, markSheet: { height: '100%', width: '90%', maxWidth: 400, backgroundColor: colors.surface, paddingTop: 16, borderTopLeftRadius: 20, borderBottomLeftRadius: 20, boxShadow: '-4px 0 24px rgba(41,46,41,0.12)' },
  overlay: { flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 16 }, sheet: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, maxHeight: '95%', width: '100%', maxWidth: 720, alignSelf: 'center' },
  sheetContent: { padding: 16, gap: 20 }, markCard: { gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line },
});
