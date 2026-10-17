import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Book } from '@/content/books';
import type { StudyState } from '@/server/study.mjs';
import { BookReading } from '@/features/bookmark/BookReading';
import PdfBook from '@/features/pdf/PdfBook';
import { colors } from '@/shared/theme';
import { studySectionNumber } from './format.mjs';

type Level = 'beginner' | 'standard' | 'original';
const levels: { id: Level; label: string; description: string }[] = [
  { id: 'beginner', label: '初級', description: '前提知識・用語・具体例から、重要な基礎を学びます。' },
  { id: 'standard', label: '中級', description: '定義・公式・条件・応用を学び、原文を読める力につなげます。' },
  { id: 'original', label: '原文', description: '元の教材をそのまま読み、証明や図表を含めて確認します。' },
];
export function StudyReader({ book, pdfUri }: { book: Book; pdfUri: string | null }) {
  const [level, setLevel] = useState<Level>('beginner');
  const [state, setState] = useState<StudyState | null>(null);
  const [displayControl, setDisplayControl] = useState<ReactNode>(null);
  const [index, setIndex] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [scrollRequest, setScrollRequest] = useState<{ offset: number; token: number } | null>(null);
  const [expandedChapterIndex, setExpandedChapterIndex] = useState<number | null>(0);
  const { width } = useWindowDimensions();
  const [sidebarOpen, setSidebarOpen] = useState(() => width >= 900);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const running = useRef(false), alive = useRef(true), controller = useRef<AbortController | null>(null);
  const preference = `dopabooks:study-level:v2:${book.id}`;
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(preference).then(raw => {
      if (!active || !raw) return;
      const saved = JSON.parse(raw);
      if (levels.some(item => item.id === saved.level)) setLevel(saved.level);
      if (Number.isInteger(saved.index) && saved.index >= 0) setIndex(saved.index);
      if (Number.isInteger(saved.chapterIndex) && saved.chapterIndex >= 0) { setChapterIndex(saved.chapterIndex); setExpandedChapterIndex(saved.chapterIndex); }
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [preference]);
  useEffect(() => {
    if (ready) void AsyncStorage.setItem(preference, JSON.stringify({ level, index, chapterIndex })).catch(() => {});
  }, [preference, ready, level, index, chapterIndex]);
  useEffect(() => {
    if (!state) return;
    if (!state.chapters[chapterIndex]) { setChapterIndex(0); return; }
    if (!state.chapters[chapterIndex].units.includes(index)) setIndex(state.chapters[chapterIndex].units[0]);
  }, [index, chapterIndex, state]);
  async function request(action: 'status' | 'generate' | 'enhance', chapter?: number): Promise<StudyState> {
    controller.current = new AbortController();
    const response = await fetch('/api/study', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.current.signal,
      body: JSON.stringify({ action, id: book.id, ...(action !== 'status' ? { chapter } : {}) }) });
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
  function updateSelectedSection(offset: number) {
    const section = [...chapterSections].reverse().find(item => item.startOffset <= offset);
    if (section && section.unit.index !== index) setIndex(section.unit.index);
  }
  const studyInfo = chapter ? `${chapter.title}　${loading ? '…' : `${chapter.units.filter(i => state?.units[i].lesson).length}/${chapter.units.length}区分${busy ? '・生成中' : ''}`}　${current ? `${current.firstPage}〜${current.lastPage}p` : ''}` : '';
  const action = (label: string, onPress: () => void, disabled = false, chosen = false) => <Pressable accessibilityRole="button" accessibilityState={{ selected: chosen, disabled }} disabled={disabled} onPress={onPress} style={[styles.button, chosen && styles.chosen, disabled && { opacity: 0.4 }]}><Text style={[styles.text, chosen && { color: colors.surface }]}>{label}</Text></Pressable>;
  const studyToolbar = <View style={styles.topRow}>
    <View accessibilityRole="tablist" style={styles.levelBar}>{levels.map(item => <Pressable key={item.id} accessibilityRole="tab"
      accessibilityState={{ selected: item.id === level, disabled: !ready || busy }} disabled={!ready || busy}
      onPress={() => setLevel(item.id)}
      style={[styles.levelTab, item.id === level && styles.levelTabActive]}>
      <Text style={[styles.levelText, item.id === level && styles.levelTextActive]}>{item.label}</Text>
    </Pressable>)}</View>
  </View>;
  const lessonCreateAction = level !== 'original' && chapter && (!chapter.complete || chapter.needsIllustrations)
    ? busy ? action('作成中…　停止', () => { running.current = false; })
      : action(chapter.baseComplete ? '不足分の図・挿絵を作成（有料）' : chapter.units.some(i => !!state?.units[i].lesson) ? '未作成分を作成（有料）' : '教材・図・挿絵を作成（有料）', () => void generate(), loading)
    : null;
  const supplementAction = level !== 'original' && chapter && !chapter.baseComplete && chapter.units.some(i => !!state?.units[i].lesson) && !chapter.enhanced
    ? action('図解を追加（有料）', () => void generate('enhance'), loading || busy)
    : null;
  return <View style={styles.container}>
    <View style={styles.controls}>
      {!state && !loading && action('保存状態を再確認', () => void load())}
      {!!(error || current?.error) && <Text accessibilityLiveRegion="polite" style={styles.error}>{error || current?.error}</Text>}
    </View>
    <View style={styles.readerRow}>
      <View style={[styles.sidebar, { width: sidebarOpen ? (width >= 1200 ? 240 : 210) : 42 }]}>
        <View style={styles.sidebarHeader}>
          {sidebarOpen && <Text accessibilityRole="header" style={styles.sidebarTitle}>章・区分</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={sidebarOpen ? '目次を閉じる' : '目次を開く'} accessibilityState={{ expanded: sidebarOpen }}
            onPress={() => setSidebarOpen(open => !open)} style={styles.sidebarToggle}>
            <Text style={styles.sidebarToggleText}>{sidebarOpen ? '‹' : '›'}</Text>
          </Pressable>
        </View>
        {sidebarOpen && <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.chapterList}>
          {state?.chapters.map(item => {
            const selectedChapter = item.index === chapterIndex;
            const expanded = item.index === expandedChapterIndex;
            return <View key={item.index}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedChapter, expanded, disabled: busy }} disabled={busy}
                onPress={() => {
                  if (expanded) { setExpandedChapterIndex(null); return; }
                  setExpandedChapterIndex(item.index);
                  if (!selectedChapter) { setChapterIndex(item.index); setIndex(item.units[0]); setError(''); }
                }} style={[styles.chapter, selectedChapter && styles.activeChapter, busy && { opacity: 0.6 }]}>
                <Text style={[styles.chapterTitle, selectedChapter && styles.activeText]}>{item.title}</Text>
                <Text style={[styles.chapterNote, selectedChapter && styles.activeText]}>{item.complete && !item.needsIllustrations ? '✓ 教材・図・挿絵を保存済み' : item.baseComplete && item.complete ? '教材・図解済み、挿絵未完了' : item.needsVisuals ? '本文あり・図解未完了' : `${item.firstPage}〜${item.lastPage}p`}</Text>
              </Pressable>
              {expanded && level !== 'original' && item.units.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll} contentContainerStyle={styles.unitList}>
                {item.units.map((unitIndex, part) => {
                  const unit = state?.units[unitIndex];
                  const selectedUnit = index === unitIndex;
                  return <Pressable key={unitIndex} accessibilityRole="button" accessibilityState={{ selected: selectedUnit, disabled: busy }} disabled={busy}
                    accessibilityLabel={`区分 ${part + 1}: ${unit?.title ?? `区分 ${part + 1}`}、${unit?.lesson ? '生成済み' : '未生成'}`}
                    onPress={() => {
                      setIndex(unitIndex); setError('');
                      const section = chapterSections.find(item => item.unit.index === unitIndex);
                      if (section) setScrollRequest({ offset: section.startOffset + 5, token: Date.now() });
                    }} style={[styles.unit, unit?.lesson && styles.generatedUnit, selectedUnit && styles.activeUnit]}>
                    <Text style={[styles.unitNumber, (unit?.lesson || selectedUnit) && styles.activeUnitText]}>{part + 1}</Text>
                  </Pressable>;
                })}
              </ScrollView>}
            </View>;
          })}
        </ScrollView>}
      </View>
      <View style={styles.reading}>
    <View style={styles.modeToolsRow}>
      {studyToolbar}
      {lessonCreateAction}
      {supplementAction}
      {displayControl}
      <Text numberOfLines={1} style={styles.originalInfo}>{studyInfo}</Text>
    </View>
    {level === 'original' ? <>
      {pdfUri ? <PdfBook uri={pdfUri} initialPage={chapter?.firstPage ?? 1} dom={{ style: { flex: 1 } }} /> : <Text style={styles.empty}>原文PDFを準備しています…</Text>}
    </>
      : chapterHasLesson && current && state && chapter ? <BookReading key={`${book.id}:${state.hash}:${level}:${chapterIndex}`} study onStudyDisplayControl={setDisplayControl}
        studyScrollTarget={scrollRequest} onStudyPosition={updateSelectedSection} trackingId={book.id} studyVisuals={chapterVisuals} sourceLabel={`${book.author}「${book.title}」・${book.license}／AIによる翻案`}
        book={{ id: `study:${book.id}:${state.hash}:${level}:${chapterIndex}`, aozoraId: 0, title: `${book.title}・${selected.label}`, subtitle: chapter.title, author: book.author,
          cardUrl: book.source ?? '', htmlUrl: book.source ?? '', characters: '', importedAt: state.hash,
          text: `${chapterContent}\n\nAIによる学習補助教材です。図・式・厳密な条件は原文でも確認してください。` }} />
        : <View style={styles.empty}><Text style={styles.text}>{chapter?.title ?? '学びたい章を選んでください。'}</Text><Text style={styles.note}>教材作成ボタンを押すと、選択中の章の初級・中級教材、図・グラフ・挿絵をまとめて作成・保存します。他の章は作成せず、保存済みの教材を開くだけではAPIを使いません。</Text></View>}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, controls: { padding: 8, gap: 5, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  levelBar: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderColor: colors.line, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.surface },
  levelTab: { minWidth: 48, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: colors.line },
  levelTabActive: { backgroundColor: colors.accent }, levelText: { color: colors.ink, fontSize: 13, fontWeight: '600' }, levelTextActive: { color: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  button: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, chosen: { backgroundColor: colors.accent },
  text: { color: colors.ink, fontSize: 14 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: '#a32323', fontSize: 13 }, empty: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  readerRow: { flex: 1, flexDirection: 'row', minHeight: 0 }, reading: { flex: 1, minWidth: 0 },
  modeToolsRow: { minHeight: 46, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingLeft: 12, gap: 8 }, aaSpacer: { width: 38, height: 38, flexShrink: 0 }, originalInfo: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 12 },
  sidebar: { borderRightWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: 6 },
  sidebarHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  sidebarTitle: { color: colors.muted, fontSize: 12, paddingHorizontal: 5 },
  sidebarToggle: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: colors.surface },
  sidebarToggleText: { color: colors.accent, fontSize: 22, lineHeight: 24 },
  chapterList: { gap: 6, paddingBottom: 12 },
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
