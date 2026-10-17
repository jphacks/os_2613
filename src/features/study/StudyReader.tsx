import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Book } from '@/content/books';
import type { StudyState } from '@/server/study.mjs';
import { BookReading } from '@/features/bookmark/BookReading';
import PdfBook from '@/features/pdf/PdfBook';
import { colors } from '@/shared/theme';

type Level = 'beginner' | 'standard' | 'original';
const levels: { id: Level; label: string; description: string }[] = [
  { id: 'beginner', label: '初級', description: '前提知識・用語・具体例から、重要な基礎を学びます。' },
  { id: 'standard', label: '中級', description: '定義・公式・条件・応用を学び、原文を読める力につなげます。' },
  { id: 'original', label: '原文', description: '元の教材をそのまま読み、証明や図表を含めて確認します。' },
];
export function StudyReader({ book, pdfUri }: { book: Book; pdfUri: string | null }) {
  const [level, setLevel] = useState<Level>('beginner');
  const [state, setState] = useState<StudyState | null>(null);
  const [index, setIndex] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
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
      if (Number.isInteger(saved.chapterIndex) && saved.chapterIndex >= 0) setChapterIndex(saved.chapterIndex);
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
      while (running.current && value && !(action === 'enhance' ? value.chapters[target].enhanced : value.chapters[target].complete)) {
        value = await request(action, target);
        if (!alive.current) return;
        setState(value);
      }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '作成できませんでした。'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  async function illustrate() {
    if (busy || running.current || level === 'original') return;
    setBusy(true); setImageBusy(true); running.current = true; setError('');
    try {
      controller.current = new AbortController();
      const response = await fetch('/api/study', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.current.signal,
        body: JSON.stringify({ action: 'illustrate', id: book.id, chapter: chapterIndex, unit: index, level }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? '挿絵を作成できませんでした。');
      if (alive.current) setState(result);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '挿絵を作成できませんでした。'); }
    finally { running.current = false; if (alive.current) { setBusy(false); setImageBusy(false); } }
  }
  const current = state?.units[index], lesson = current?.lesson;
  const chapter = state?.chapters[chapterIndex];
  const selected = levels.find(item => item.id === level)!;
  const action = (label: string, onPress: () => void, disabled = false, chosen = false) => <Pressable accessibilityRole="button" accessibilityState={{ selected: chosen, disabled }} disabled={disabled} onPress={onPress} style={[styles.button, chosen && styles.chosen, disabled && { opacity: 0.4 }]}><Text style={[styles.text, chosen && { color: colors.surface }]}>{label}</Text></Pressable>;
  return <View style={styles.container}>
    <View style={styles.controls}>
      <View style={styles.row}>{levels.map(item => <View key={item.id}>{action(item.label, () => setLevel(item.id), !ready, item.id === level)}</View>)}</View>
      <Text style={styles.note}>{selected.description}</Text>
      <Text style={styles.text} numberOfLines={2}>{chapter?.title ?? '左の一覧から学びたい章を選びます。'}</Text>
      <View style={styles.row}>
        {!imageBusy && (level !== 'original' || busy) && action(busy ? 'この範囲の保存後に停止' : chapter?.complete ? 'この章は保存済み' : chapter?.needsVisuals && chapter.baseComplete ? 'この章に図解・公式を追加（有料）' : 'この章を図解付きで作成・再開（有料）', () => { if (busy) running.current = false; else void generate(); }, loading || (!busy && (!chapter || chapter.complete)))}
        {!state && !loading && action('保存状態を再確認', () => void load())}
      </View>
      {imageBusy && <Text accessibilityLiveRegion="polite" style={styles.note}>挿絵を作成しています。数分かかる場合があります。完成した画像から保存します。</Text>}
      {level !== 'original' && chapter?.complete && !chapter.enhanced && !busy && action('この章の図・グラフを増やす（有料）', () => void generate('enhance'))}
      {level !== 'original' && lesson && !busy && action(lesson.illustrationsComplete?.[level] ? 'この範囲の挿絵は保存済み' : `この範囲に挿絵を追加（有料・${level === 'beginner' ? '最大2枚' : '最大1枚'}）`, () => void illustrate(), !!lesson.illustrationsComplete?.[level])}
      <Text accessibilityLiveRegion="polite" style={styles.note}>{loading ? '保存済み教材を確認しています…' : chapter ? `${chapter.units.filter(i => state?.units[i].lesson).length}/${chapter.units.length}範囲の本文を保存済み。${busy ? '選択した章だけを作成中です。' : chapter.complete ? '図解も保存済み。難易度を変えても再生成しません。' : `図解を含め残り${chapter.remainingRequests}回の生成。他の章は生成しません。`}` : ''}</Text>
      {!!(error || current?.error) && <Text accessibilityLiveRegion="polite" style={styles.error}>{error || current?.error}</Text>}
      {level !== 'original' && state && chapter && <>
        {chapter.units.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{chapter.units.map((unitIndex, part) => <View key={unitIndex}>{action(`${part + 1}${state.units[unitIndex].lesson ? ' ✓' : ''}`, () => setIndex(unitIndex), false, index === unitIndex)}</View>)}</ScrollView>}
        <Text style={styles.note} numberOfLines={2}>{current?.title}　原文 {current?.firstPage}〜{current?.lastPage}ページ</Text>
      </>}
    </View>
    <View style={styles.readerRow}>
      <View style={[styles.sidebar, { width: width >= 900 ? 220 : width >= 600 ? 180 : 110 }]}>
        <Text accessibilityRole="header" style={styles.sidebarTitle}>章を選ぶ</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.chapterList}>{state?.chapters.map(item => <Pressable key={item.index} accessibilityRole="button" accessibilityState={{ selected: item.index === chapterIndex, disabled: busy }} disabled={busy}
          onPress={() => { setChapterIndex(item.index); setIndex(item.units[0]); setError(''); }} style={[styles.chapter, item.index === chapterIndex && styles.activeChapter, busy && { opacity: 0.6 }]}>
          <Text style={[styles.chapterTitle, item.index === chapterIndex && styles.activeText]}>{item.title}</Text>
          <Text style={[styles.chapterNote, item.index === chapterIndex && styles.activeText]}>{item.complete ? '✓ 図解まで保存済み' : item.needsVisuals ? '本文あり・図解未作成' : `${item.firstPage}〜${item.lastPage}p`}</Text>
        </Pressable>)}</ScrollView>
      </View>
      <View style={styles.reading}>
    {level === 'original' ? pdfUri ? <PdfBook uri={pdfUri} initialPage={chapter?.firstPage ?? 1} dom={{ style: { flex: 1 } }} /> : <Text style={styles.empty}>原文PDFを準備しています…</Text>
      : lesson && current && state ? <BookReading key={`${book.id}:${state.hash}:${level}:${index}`} study trackingId={book.id} studyVisuals={level === 'beginner' ? lesson.beginnerVisuals : lesson.standardVisuals} sourceLabel={`${book.author}「${book.title}」・${book.license}／AIによる翻案`}
        book={{ id: `study:${book.id}:${state.hash}:${level}:${index}`, aozoraId: 0, title: `${book.title}・${selected.label}`, subtitle: current.title, author: book.author,
          cardUrl: book.source ?? '', htmlUrl: book.source ?? '', characters: '', importedAt: state.hash,
          text: `${lesson.title}\n\n${lesson[level as 'beginner' | 'standard']}\n\n原文 ${current.firstPage}〜${current.lastPage}ページをもとに作成。AIによる学習補助教材です。図・式・厳密な条件は原文でも確認してください。` }} />
        : <View style={styles.empty}><Text style={styles.heading}>{selected.label}で学ぶ</Text><Text style={styles.text}>{chapter?.title ?? '学びたい章を選んでください。'}</Text><Text style={styles.note}>「この章の初級・中級を作成」を押すまでAIを使用しません。選んだ章の重要事項と前提知識を整理して作成・保存します。他の章や教材全体のAI分析は行いません。原文はそのまま読めます。</Text></View>}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, controls: { padding: 8, gap: 5, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  button: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, chosen: { backgroundColor: colors.accent },
  text: { color: colors.ink, fontSize: 14 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: '#a32323', fontSize: 13 }, empty: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' }, heading: { fontSize: 22, color: colors.ink },
  readerRow: { flex: 1, flexDirection: 'row', minHeight: 0 }, reading: { flex: 1, minWidth: 0 },
  sidebar: { borderRightWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: 6 },
  sidebarTitle: { color: colors.muted, fontSize: 12, padding: 5 }, chapterList: { gap: 6, paddingBottom: 12 },
  chapter: { paddingHorizontal: 8, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface, gap: 5 },
  activeChapter: { backgroundColor: colors.accent, borderColor: colors.accent }, activeText: { color: colors.surface },
  chapterTitle: { color: colors.ink, fontSize: 13, lineHeight: 19 }, chapterNote: { color: colors.muted, fontSize: 11 },
});
