import { domBootstrap } from '@/features/reader/dom-bootstrap.mjs';
import { Stack } from 'expo-router';
import { parsePdfMarks, type PdfMark } from '@/features/pdf/bookmarks.mjs';
import { PageBar } from '@/features/reader/PageBar';
import { ReaderPanel, usePhoneReaderPanel } from '@/shared/ReaderPanel';
import { AppIcon } from '@/shared/AppIcon';
import { StudyToolsContext, StudyToolPanel, type StudyTool } from './StudyToolPanel';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Book } from '@/content/books';
import type { StudyState } from '@/server/study.mjs';
import { BookReading } from '@/features/bookmark/BookReading';
import PdfBook from '@/features/pdf/PdfBook';
import { PdfDisplayControls } from '@/features/pdf/PdfDisplayControls';
import { NavigationButton } from '@/shared/NavigationButton';
import { colors } from '@/shared/theme';
import { studySectionNumber } from './format.mjs';
import { StudyMusic } from '@/features/music/StudyMusic';
import { artifactUrl } from '@/features/comic/api';

type Level = 'beginner' | 'standard' | 'original';
const levels: { id: Level; label: string; description: string }[] = [
  { id: 'beginner', label: '初級', description: '前提知識・用語・具体例から、重要な基礎を学びます。' },
  { id: 'standard', label: '中級', description: '定義・公式・条件・応用を学び、原文を読める力につなげます。' },
  { id: 'original', label: '原文', description: '元の教材をそのまま読み、証明や図表を含めて確認します。' },
];
export function StudyReader({ book, pdfUri }: { book: Book; pdfUri: string | null }) {
  const phone = usePhoneReaderPanel();
  const [pdfSize, setPdfSize] = useState({ width: 0, height: 0 });
  const [level, setLevel] = useState<Level>('original');
  const [pdfPosition, setPdfPosition] = useState({ page: 1, total: 0 });
  const [pdfRequest, setPdfRequest] = useState<{ page: number; token: number } | null>(null);
  const updatePdfPosition = useCallback((page: number, total: number) => setPdfPosition(before => before.page === page && before.total === total ? before : { page, total }), []);
  const requestPdfPage = (page: number) => setPdfRequest({ page, token: Date.now() });
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfSpread, setPdfSpread] = useState(() => !phone);
  const [state, setState] = useState<StudyState | null>(null);
  const [displayControl, setDisplayControl] = useState<ReactNode>(null);
  const [index, setIndex] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [scrollRequest, setScrollRequest] = useState<{ offset: number; token: number } | null>(null);
  const [chapterDropdownOpen, setChapterDropdownOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<StudyTool>(null);
  const changeMusicOpen = useCallback((open: boolean) => setActiveTool(open ? 'music' : null), []);
  const sidebarOpen = activeTool === 'chapters';
  const setSidebarOpen = (open: boolean) => setActiveTool(open ? 'chapters' : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [readerAttempt, setReaderAttempt] = useState(0);
  const [readyContent, setReadyContent] = useState('');
  const [contentError, setContentError] = useState({ key: '', message: '' });
  const running = useRef(false), alive = useRef(true), controller = useRef<AbortController | null>(null);
  // 初級・中級は章や読書位置を復元せず、選んだ章の先頭から読む。
  useEffect(() => { setReady(true); }, []);
  const [pdfMarks, setPdfMarks] = useState<PdfMark[]>([]);
  const [marksReady, setMarksReady] = useState(false), [savingMark, setSavingMark] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false), [pickingMark, setPickingMark] = useState(false);
  const [pdfFingerprint, setPdfFingerprint] = useState('');
  const markKey = `dopabooks:pdf-marks:v1:${book.id}`;
  useEffect(() => { let active = true; void AsyncStorage.getItem(markKey).then(raw => { const marks = parsePdfMarks(raw); if (active) { setPdfMarks(marks); setMarksReady(true); } }).catch(() => { if (active) setError('しおりを読み込めません。保存設定を確認して教材を開き直してください。記録は上書きしていません。'); }); return () => { active = false; }; }, [markKey]);
  async function savePdfMarks(next: PdfMark[]) {
    if (!marksReady || savingMark) return;
    setSavingMark(true);
    try { parsePdfMarks(JSON.stringify(next)); await AsyncStorage.setItem(markKey, JSON.stringify(next)); setPdfMarks(next); setPickingMark(false); setError(''); }
    catch { setError('しおりを保存できません。保存設定を確認して再試行してください。'); }
    finally { setSavingMark(false); }
  }
  function placePdfMark(mark: Omit<PdfMark, 'id'>) {
    if (pdfMarks.some(saved => saved.source === mark.source && saved.page === mark.page && saved.offset === mark.offset)) { setPickingMark(false); return; }
    void savePdfMarks([...pdfMarks, { ...mark, id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
  }
  useEffect(() => {
    if (!state) return;
    if (!state.chapters[chapterIndex]) { setChapterIndex(0); return; }
    if (!state.chapters[chapterIndex].units.includes(index)) setIndex(state.chapters[chapterIndex].units[0]);
  }, [index, chapterIndex, state]);
  async function request(action: 'status' | 'generate' | 'enhance', chapter?: number): Promise<StudyState> {
    controller.current = new AbortController();
    const response = await fetch(artifactUrl('/api/study'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.current.signal,
      body: JSON.stringify({ action, id: book.id, ...(action !== 'status' ? { chapter } : {}) }) });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('教材サーバーに接続できません。最新のQRコードからアプリを接続し直してください。');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? '教材を読み込めませんでした。');
    return result;
  }
  async function load() {
    setLoading(true); setError('');
    try { const value = await request('status'); if (alive.current) { setState(value); setIndex(i => Math.min(i, value.units.length - 1)); } }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '保存内容を読み込めません。'); }
    finally { if (alive.current) setLoading(false); }
  }
  useEffect(() => {
    alive.current = true; void load();
    return () => { alive.current = false; running.current = false; controller.current?.abort(); };
  }, [book.id]);
  async function generate(action: 'generate' | 'enhance' = 'generate') {
    if (running.current || busy) return;
    running.current = true; setBusy(true); setError('');
    try {
      let value = state;
      const target = chapterIndex;
      while (running.current && value && !(action === 'enhance' ? value.chapters[target].enhanced : value.chapters[target].complete && !value.chapters[target].needsIllustrations)) {
        value = await request(action, target);
        if (!alive.current) return;
        setState(value);
      }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '作成できませんでした。'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  const current = state?.units[index], lesson = current?.lesson;
  const chapter = state?.chapters[chapterIndex];
  const selected = levels.find(item => item.id === level)!;
  let sectionOffset = 0;
  const chapterSections = (chapter?.units ?? []).map(unitIndex => {
    const unit = state?.units[unitIndex];
    if (!unit) return null;
    const sectionText = `## ${studySectionNumber(unit.title, unit.chapter, unit.part)}\n\n${unit.lesson ? `${unit.lesson.title}\n\n${unit.lesson[level === 'beginner' ? 'beginner' : 'standard']}` : 'この区分の教材はまだ作成されていません。難易度を選び、作成メニューから生成してください。'}`;
    const startOffset = sectionOffset;
    sectionOffset += sectionText.length + 2;
    return { unit, text: sectionText, startOffset };
  }).filter((section): section is NonNullable<typeof section> => !!section);
  const chapterContent = chapterSections.map(section => section.text).join('\n\n');
  const chapterHasLesson = chapterSections.some(section => !!section.unit.lesson);
  const chapterVisuals = chapterSections.flatMap(section => section.unit.lesson
    ? (level === 'beginner' ? section.unit.lesson.beginnerVisuals : section.unit.lesson.standardVisuals) ?? []
    : []);
  const contentKey = `${book.id}:${level}:${level === 'original' ? `${pdfUri}` : `${state?.hash}:${chapterIndex}`}:${readerAttempt}`;
  const contentReady = useCallback(() => setReadyContent(contentKey), [contentKey]);
  const contentFailed = useCallback((message: string) => setContentError({ key: contentKey, message }), [contentKey]);
  const readLocalPdf = useCallback(async (offset: number, length: number) => {
    if (!pdfUri) throw new Error('PDF_NOT_AVAILABLE');
    const { getInfoAsync, readAsStringAsync } = await import('expo-file-system/legacy');
    const info = await getInfoAsync(pdfUri);
    if (!info.exists || info.isDirectory) throw new Error('PDF_NOT_AVAILABLE');
    const base64 = await readAsStringAsync(pdfUri, { encoding: 'base64', position: offset, length });
    return { size: info.size, base64 };
  }, [pdfUri]);
  const waiting = !ready || (level === 'original' ? !pdfUri || readyContent !== contentKey : loading || (chapterHasLesson && readyContent !== contentKey));
  const waitingError = contentError.key === contentKey ? contentError.message : '';
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => contentFailed('教材の準備に時間がかかっています。接続を確認して、もう一度お試しください。'), 30000);
    return () => clearTimeout(timer);
  }, [waiting, contentFailed]);
  function retryContent() {
    setReaderAttempt(value => value + 1);
    setContentError({ key: '', message: '' });
    if (level !== 'original' && !state) { controller.current?.abort(); void load(); }
  }
  function updateSelectedSection(offset: number) {
    const section = [...chapterSections].reverse().find(item => item.startOffset <= offset);
    if (section && section.unit.index !== index) setIndex(section.unit.index);
  }
  const action = (label: string, onPress: () => void, disabled = false, chosen = false) => <Pressable accessibilityRole="button" accessibilityState={{ selected: chosen, disabled }} disabled={disabled} onPress={onPress} style={[styles.button, chosen && styles.chosen, disabled && { opacity: 0.4 }]}><Text style={[styles.text, chosen && { color: colors.surface }]}>{label}</Text></Pressable>;
  const studyToolbar = <View style={styles.topRow}>
    <View accessibilityRole="tablist" style={styles.levelBar}>{levels.map(item => <Pressable key={item.id} accessibilityRole="tab"
      accessibilityState={{ selected: item.id === level, disabled: !ready || busy }} disabled={!ready || busy}
      onPress={() => { setLevel(item.id); setChapterDropdownOpen(false); setSidebarOpen(true); }}
      style={[styles.levelTab, item.id === level && styles.levelTabActive]}>
      <Text style={[styles.levelText, item.id === level && styles.levelTextActive]}>{item.label}</Text>
    </Pressable>)}</View>
  </View>;
  const lessonCreateAction = level !== 'original' && chapter
    ? action(busy ? '生成を停止' : chapter.complete && !chapter.needsIllustrations ? '生成済み' : chapter.baseComplete ? '不足分を生成（有料）' : 'この章を生成（有料）',
      () => { if (busy) running.current = false; else void generate(); }, loading || (!busy && chapter.complete && !chapter.needsIllustrations), !busy && !(chapter.complete && !chapter.needsIllustrations))
    : null;
  const chapterSelector = <>
    <View style={styles.sidebarHeader}><Text accessibilityRole="header" style={styles.sidebarTitle}>{selected.label}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="章を選択" accessibilityState={{ expanded: chapterDropdownOpen, disabled: busy }} disabled={busy}
      onPress={() => setChapterDropdownOpen(value => !value)} style={[styles.button, { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }]}>
      <Text style={[styles.text, { flex: 1 }]}>{chapter?.title ?? '章を選ぶ'}</Text><Text style={styles.text}>{chapterDropdownOpen ? '⌃' : '⌄'}</Text>
    </Pressable>
    {chapterDropdownOpen && <ScrollView style={{ flexGrow: 0, flexShrink: 1, marginBottom: 12 }} contentContainerStyle={styles.chapterList}>
      {state?.chapters.map(item => <Pressable key={item.index} accessibilityRole="button" accessibilityState={{ selected: item.index === chapterIndex }} onPress={() => {
        setChapterIndex(item.index); setIndex(item.units.find(unit => !!state?.units[unit]?.lesson) ?? item.units[0] ?? 0);
        setScrollRequest(null); setContentError({ key: '', message: '' }); setError(''); setChapterDropdownOpen(false);
      }} style={[styles.chapter, item.index === chapterIndex && styles.activeChapter]}>
        <Text style={[styles.chapterTitle, item.index === chapterIndex && styles.activeText]}>{item.title}</Text>
      </Pressable>)}
    </ScrollView>}
    <View style={styles.panelActions}>{lessonCreateAction}</View>
  </>;
  const panelToolbar = <View style={{ gap: 8, alignItems: 'center' }}>
    <View style={{ gap: 4 }}>{levels.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.label}の章を選択`} disabled={!ready || busy} onPress={() => { setLevel(item.id); setActiveTool('chapters'); }} style={[styles.levelTab, { borderRadius: 9, backgroundColor: colors.button }, level === item.id && styles.levelTabActive]}><Text style={[styles.levelText, level === item.id && styles.levelTextActive]}>{item.label}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="表示設定" onPress={() => setActiveTool('display')} style={styles.featureButton}><Text style={styles.aa}>Aa</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="曲を選択" onPress={() => setActiveTool('music')} style={styles.featureButton}><AppIcon name="music_note" size={28} /></Pressable>
  </View>;
  return <StudyToolsContext.Provider value={{ active: activeTool, select: setActiveTool, toolbar: panelToolbar }}><View style={styles.container}>
    {level === 'original' && <Stack.Screen options={{ headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="PDFのしおり" onPress={() => setMarksOpen(true)} style={styles.button}><Text style={styles.text}>しおり</Text></Pressable> }} />}
    <ReaderPanel visible={marksOpen && level === 'original'} label="しおり" onClose={() => setMarksOpen(false)} desktop={<Modal visible={marksOpen && level === 'original'} transparent animationType="fade" onRequestClose={() => setMarksOpen(false)}><View style={{ flex: 1, alignItems: 'flex-end' }}><Pressable style={StyleSheet.absoluteFill} onPress={() => setMarksOpen(false)} /><View style={[styles.sidebar, { margin: 12, flex: 1 }]}><Text style={styles.sidebarTitle}>しおり</Text><ScrollView>{pdfMarks.filter(mark => mark.source === pdfFingerprint).map(mark => <View key={mark.id} style={styles.chapter}><Pressable onPress={() => { requestPdfPage(mark.page); setMarksOpen(false); }}><Text style={styles.text}>{mark.page}ページ · {mark.offset === null ? 'ページのしおり' : mark.quote}</Text></Pressable><Pressable accessibilityRole="button" style={{ backgroundColor: colors.dangerBackground, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, alignSelf: 'flex-start' }} onPress={() => void savePdfMarks(pdfMarks.filter(saved => saved.id !== mark.id))}><Text style={[styles.note, { color: colors.danger }]}>外す</Text></Pressable></View>)}</ScrollView>{action('文字を選んで挟む', () => { setPickingMark(true); setMarksOpen(false); }, !marksReady || !pdfFingerprint || savingMark)}{action('このページに挟む', () => { placePdfMark({ page: pdfPosition.page, offset: null, quote: '', source: pdfFingerprint }); setMarksOpen(false); }, !marksReady || !pdfFingerprint || savingMark)}{action('閉じる', () => setMarksOpen(false))}</View></View></Modal>}>
      <Text style={styles.sidebarTitle}>しおり</Text>
      {action('文字を選んで挟む', () => { setPickingMark(true); setMarksOpen(false); }, !marksReady || !pdfFingerprint || savingMark)}
      {action('このページに挟む', () => { placePdfMark({ page: pdfPosition.page, offset: null, quote: '', source: pdfFingerprint }); setMarksOpen(false); }, !marksReady || !pdfFingerprint || savingMark)}
      <ScrollView>{pdfMarks.filter(mark => mark.source === pdfFingerprint).map(mark => <View key={mark.id} style={styles.chapter}><Pressable onPress={() => { requestPdfPage(mark.page); setMarksOpen(false); }}><Text style={styles.text}>{mark.page}ページ · {mark.offset === null ? 'ページのしおり' : mark.quote}</Text></Pressable><Pressable accessibilityRole="button" style={{ backgroundColor: colors.dangerBackground, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, alignSelf: 'flex-start' }} onPress={() => void savePdfMarks(pdfMarks.filter(saved => saved.id !== mark.id))}><Text style={[styles.note, { color: colors.danger }]}>外す</Text></Pressable></View>)}</ScrollView>
    </ReaderPanel>
    {((!state && !loading) || !!(error || current?.error)) && <View style={styles.controls}>
      {!state && !loading && action('保存状態を再確認', () => void load())}
      {!!(error || current?.error) && <Text accessibilityLiveRegion="polite" style={styles.error}>{error || current?.error}</Text>}
    </View>}
    <View style={styles.readerRow}>
      <ReaderPanel visible={sidebarOpen} label={selected.label} onClose={() => setSidebarOpen(false)} desktop={<StudyToolPanel visible={sidebarOpen} transparent animationType="fade" onRequestClose={() => setSidebarOpen(false)}>
        <View style={styles.panelHost}>
          <Pressable accessibilityRole="button" accessibilityLabel="章の選択を閉じる" onPress={() => setSidebarOpen(false)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.sidebar}>{chapterSelector}</View>
        </View>
      </StudyToolPanel>}>{chapterSelector}</ReaderPanel>
      <View style={styles.reading}>
    <View style={styles.modeToolsRow}>
      {studyToolbar}
      {level === 'original' ? <PdfDisplayControls zoom={pdfZoom} spread={pdfSpread} onZoom={setPdfZoom} onSpread={setPdfSpread} /> : displayControl}
      <StudyMusic open={activeTool === 'music'} onOpenChange={changeMusicOpen} />
    </View>
    {pickingMark && <View style={styles.row}><Text style={styles.note}>挟む文字を押してください。画像部分は「このページに挟む」を使えます。</Text>{action('キャンセル', () => setPickingMark(false))}</View>}
<View style={styles.pageContent} onLayout={event => { const { width, height } = event.nativeEvent.layout; setPdfSize(before => before.width === width && before.height === height ? before : { width, height }); }}>
    {level === 'original' ? <>
      {pdfUri && (Platform.OS === 'web' || pdfSize.width > 0 && pdfSize.height > 0) ? <PdfBook viewportSize={Platform.OS === 'web' ? undefined : pdfSize} marks={pdfMarks} picking={pickingMark && !savingMark} onPick={placePdfMark} onDocument={setPdfFingerprint} key={contentKey} onPosition={updatePdfPosition} pageRequest={pdfRequest} uri={pdfUri} readLocalPdf={Platform.OS === 'web' ? undefined : readLocalPdf} initialPage={chapter?.firstPage ?? 1} zoom={pdfZoom} spread={pdfSpread} onReady={contentReady} onLoadError={contentFailed} dom={{ useExpoDOMWebView: false, injectedJavaScriptBeforeContentLoaded: __DEV__ ? domBootstrap : undefined, contentInsetAdjustmentBehavior: 'never', style: Platform.OS === 'web' ? { flex: 1 } : { width: pdfSize.width, height: pdfSize.height }, containerStyle: { flex: 1 }, bounces: false, allowsBackForwardNavigationGestures: false, onError: () => contentFailed('PDF画面を読み込めませんでした。もう一度お試しください。'), onContentProcessDidTerminate: () => { setContentError({ key: '', message: '' }); setReaderAttempt(value => value + 1); } }} /> : <Text style={styles.empty}>原文PDFを準備しています…</Text>}
    </>
      : chapterHasLesson && current && state && chapter ? <BookReading key={contentKey} study onStudyDisplayControl={setDisplayControl} onReady={contentReady} onLoadError={contentFailed}
        studyScrollTarget={scrollRequest} onStudyPosition={updateSelectedSection} trackingId={book.id} studyVisuals={chapterVisuals} sourceLabel={`${book.author}「${book.title}」・${book.license}／AIによる翻案`}
        book={{ id: `study:${book.id}:${state.hash}:${level}:${chapterIndex}`, aozoraId: 0, title: `${book.title}・${selected.label}`, subtitle: chapter.title, author: book.author,
          cardUrl: book.source ?? '', htmlUrl: book.source ?? '', characters: '', importedAt: state.hash,
          text: `${chapterContent}\n\nAIによる学習補助教材です。図・式・厳密な条件は原文でも確認してください。` }} />
        : <View style={styles.empty}><Text style={styles.text}>{chapter?.title ?? '学びたい章を選んでください。'}</Text>{chapter && <Text style={styles.text}>この章の{selected.label}教材はまだ作成されていません。</Text>}<Text style={styles.note}>上の難易度ボタンから章を選び、教材作成ボタンを押すと、選択中の章の初級・中級教材、図・グラフ・挿絵をまとめて作成・保存します。他の章は作成せず、保存済みの教材を開くだけではAPIを使いません。</Text></View>}
      {waiting && <View style={styles.loadingOverlay}>
        <View accessibilityLiveRegion="polite" accessibilityState={{ busy: !waitingError }} style={styles.loadingCard}>
          {!waitingError && <ActivityIndicator size="large" color={colors.accent} />}
          <Text style={styles.loadingText}>{waitingError || (level === 'original' ? '原文PDFを読み込んでいます…' : '教材を読み込んでいます…')}</Text>
          {!!waitingError && action('もう一度読み込む', retryContent)}
        </View>
      </View>}
    </View>
    {level === 'original' && <View style={{ paddingTop: 6, paddingBottom: 4, flexShrink: 0 }}>
      <PageBar page={pdfPosition.page - 1} count={Math.max(1, pdfPosition.total)} disabled={!pdfPosition.total} ink={colors.ink} accent={colors.accent} line={colors.line} onChange={page => requestPdfPage(page + 1)}
        leading={<Pressable accessibilityRole="button" accessibilityLabel="前のページ" disabled={pdfPosition.page <= 1} onPress={() => requestPdfPage(Math.max(1, pdfPosition.page - (pdfSpread ? 2 : 1)))} style={[styles.button, { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }, pdfPosition.page <= 1 && { opacity: 0.35 }]}><Text style={styles.text}>‹ 前へ</Text></Pressable>}
        trailing={<Pressable accessibilityRole="button" accessibilityLabel="次のページ" disabled={!pdfPosition.total || pdfPosition.page + (pdfSpread ? 2 : 1) > pdfPosition.total} onPress={() => requestPdfPage(Math.min(pdfPosition.total, pdfPosition.page + (pdfSpread ? 2 : 1)))} style={[styles.button, { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }, pdfPosition.page + (pdfSpread ? 2 : 1) > pdfPosition.total && { opacity: 0.35 }]}><Text style={styles.text}>次へ ›</Text></Pressable>}
      />
    </View>}
      </View>
    </View>
  </View></StudyToolsContext.Provider>;
}
const styles = StyleSheet.create({
  pageContent: { flex: 1, minWidth: 0, minHeight: 0, marginHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 4, overflow: 'hidden' },
  loadingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.paper}DD` },
  loadingCard: { maxWidth: 320, margin: 24, padding: 24, gap: 16, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16 },
  loadingText: { color: colors.ink, fontSize: 15, lineHeight: 24, textAlign: 'center' },
  featureButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center' }, aa: { color: colors.accent, fontSize: 20, fontWeight: '700' },
  container: { flex: 1, backgroundColor: colors.paper }, controls: { padding: 8, gap: 5, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  levelBar: { flexDirection: 'row', alignItems: 'stretch', borderRadius: 999, padding: 3, overflow: 'hidden', backgroundColor: colors.button },
  levelTab: { minWidth: 48, minHeight: 38, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  levelTabActive: { backgroundColor: colors.accent }, levelText: { color: colors.ink, fontSize: 13, fontWeight: '600' }, levelTextActive: { color: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  button: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.button, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, chosen: { backgroundColor: colors.accent },
  text: { color: colors.ink, fontSize: 14 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: '#a32323', fontSize: 13 }, empty: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  readerRow: { flex: 1, flexDirection: 'row', minHeight: 0 }, reading: { flex: 1, minWidth: 0 },
  singleReading: { flexDirection: 'row' }, verticalTools: { width: 60, paddingLeft: 0, paddingVertical: 8, flexDirection: 'column', flexWrap: 'nowrap' },
  modeToolsRow: { minHeight: 46, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingLeft: 12, gap: 8 }, aaSpacer: { width: 38, height: 38, flexShrink: 0 }, originalInfo: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 12 },
  panelHost: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 12, paddingBottom: 12 },
  panelActions: { gap: 8, paddingBottom: 10 },
  sidebar: { width: 340, maxWidth: '94%', flex: 1, maxHeight: 640, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface, padding: 12 },
  sidebarHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  sidebarTitle: { color: colors.ink, fontSize: 18, fontWeight: '600', paddingHorizontal: 5 },
  sidebarToggle: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: colors.surface },
  sidebarToggleText: { color: colors.accent, fontSize: 22, lineHeight: 24 },
  chapterList: { gap: 6, paddingBottom: 12 },
  sectionToggle: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 8 },
  chapter: { paddingHorizontal: 8, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface, gap: 5 },
  unitScroll: { marginLeft: 6, marginTop: 4, marginBottom: 5, flexGrow: 0 },
  unitList: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 },
  unit: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: colors.surface },
  generatedUnit: { backgroundColor: '#E6F0E9', borderColor: colors.accent },
  activeUnit: { borderWidth: 2, borderColor: colors.accent },
  activeUnitText: { color: colors.accent, fontWeight: '700' },
  activeChapter: { backgroundColor: colors.accent, borderColor: colors.accent }, activeText: { color: colors.surface },
  chapterTitle: { color: colors.ink, fontSize: 13, lineHeight: 19 }, unitNumber: { color: colors.ink, fontSize: 13, fontWeight: '600' }, chapterNote: { color: colors.muted, fontSize: 11 },
});
