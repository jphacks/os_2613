import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SavedBook } from '@/features/library/types';
import { documentVersion } from '@/features/bookmark/model.mjs';
import { colors } from '@/shared/theme';
import { comicFailureMessage, introSource, validateScript, type Script } from './model.mjs';
import { artifactRequest, artifactUrl } from './api';
import { MangaPanel } from './MangaPanel';
type State = { key: string; status: 'idle' | 'running' | 'ready' | 'error'; script: Script | null; completed: number; canResumeRemaining?: boolean; canResumeScript?: boolean; hasScriptDraft?: boolean; failure?: { code: string; error: string } };
function checked(value: State, opening: string): State {
  if (!/^[a-f0-9]{64}$/.test(value?.key) || !['idle', 'running', 'ready', 'error'].includes(value.status) || !Number.isInteger(value.completed) || value.completed < 0 || value.completed > 4) throw new Error('保存内容を確認できません。画面を開き直してください。');
  const script = value.script ? validateScript(value.script, opening) : null;
  if ((!script && value.completed) || (value.status === 'ready' && (!script || value.completed !== 4))) throw new Error('保存内容を確認できません。画面を開き直してください。');
  return { ...value, script };
}
export function IntroComic({ book, read }: { book: SavedBook; read: () => void }) {
  const [edition, setEdition] = useState<'manga' | 'mini-manga' | 'previous-manga' | 'original' | 'comparison'>('manga');
  return <ComicEdition key={`${book.id}:${edition}`} book={book} read={read} edition={edition} switchEdition={setEdition} />;
}
function ComicEdition({ book, read, edition, switchEdition }: { book: SavedBook; read: () => void; edition: 'manga' | 'mini-manga' | 'previous-manga' | 'original' | 'comparison'; switchEdition: (edition: 'manga' | 'mini-manga' | 'previous-manga' | 'original' | 'comparison') => void }) {
  const comparison = edition === 'comparison', manga = edition === 'manga', previousManga = edition === 'previous-manga', miniManga = edition === 'mini-manga';
  const source = useMemo(() => introSource(book.text, book.title), [book.text, book.title]);
  const cacheKey = `${manga ? 'dopabooks:comic:manga:v4' : miniManga ? 'dopabooks:comic:manga:v3' : previousManga ? 'dopabooks:comic:manga:v2' : comparison ? 'dopabooks:comic:comparison:v1' : 'dopabooks:comic:v1'}:${book.id}:${documentVersion(JSON.stringify({ title: book.title, ...source }))}`;
  const [pageWidth, setPageWidth] = useState(0);
  const [state, setState] = useState<State | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [working, setWorking] = useState(false);
  const active = useRef(true), request = useRef<AbortController | null>(null);
  async function remember(value: State) {
    const next = checked(value, source.opening); if (!active.current) return;
    setState(next);
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ title: book.title, source, value: next })); }
    catch { if (active.current) setError('漫画は表示できますが、端末に記録できませんでした。保存設定を確認してください。'); }
  }
  async function load() {
    setLoading(true); setError('');
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      try { const raw = await AsyncStorage.getItem(cacheKey); if (raw && active.current) { const cached = JSON.parse(raw); if (cached.title === book.title && JSON.stringify(cached.source) === JSON.stringify(source)) setState(checked(cached.value, source.opening)); } } catch { /* 派生データだけを再取得する。本文・しおりは変更しない。 */ }
      const value = await artifactRequest('/api/comic', { action: 'register', bookId: book.id, title: book.title, ...source, ...(manga || previousManga || miniManga ? { edition: 'manga', ...(manga ? { revision: 4 } : miniManga ? { revision: 3 } : {}) } : comparison ? { edition } : {}) }, controller.signal);
      if (active.current) await remember(value);
    } catch { if (active.current && !controller.signal.aborted) setError('漫画の保存状態を取得できませんでした。通信を確認して、もう一度お試しください。'); else if (active.current) setError('取得に時間がかかっています。もう一度お試しください。'); }
    finally { clearTimeout(timer); if (active.current) setLoading(false); }
  }
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; request.current?.abort(); }; }, [cacheKey]);
  useEffect(() => {
    if (state?.status !== 'running') return;
    let mounted = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const timeout = setTimeout(() => controller.abort(), 15000);
      void artifactRequest(`/api/comic?key=${state.key}`, null, controller.signal).then(value => { if (!controller.signal.aborted && active.current) return remember(value); })
        .catch(() => { if (mounted && active.current) setError('進み具合を取得できません。保存状態を再確認してください。'); }).finally(() => clearTimeout(timeout));
    }, 1500);
    return () => { mounted = false; clearTimeout(timer); controller.abort(); };
  }, [state]);
  async function generate() {
    if (!state || working || state.status === 'running') return;
    setWorking(true); setError(''); const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    try { await remember(await artifactRequest('/api/comic', { action: 'start', key: state.key, ...(state.canResumeRemaining ? { resumeRemaining: true } : {}), ...(state.canResumeScript ? { resumeScript: true } : {}) }, controller.signal)); }
    catch (reason) { if (active.current) setError(reason instanceof Error && reason.name !== 'AbortError' ? reason.message : '通信が中断しました。保存状態を確認してください。'); }
    finally { clearTimeout(timer); if (active.current) setWorking(false); }
  }
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.kicker}>物語の入口</Text><Text style={styles.title}>{book.title}</Text><Text style={styles.text}>{book.author}</Text>
    <Text style={styles.heading}>4コマから、読んでみよう。</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={read}><Text style={styles.buttonText}>原文を読む →</Text></Pressable>
    <View style={styles.editions}>
      <Pressable accessibilityRole="button" disabled={working || state?.status === 'running'} style={styles.button} onPress={() => switchEdition(manga ? 'original' : 'manga')}><Text style={styles.buttonText}>{manga ? '以前の漫画を見る' : '吹き出しのある漫画版を見る'}</Text></Pressable>
      {!manga && !previousManga && !miniManga && <Pressable accessibilityRole="button" disabled={working || state?.status === 'running'} style={styles.button} onPress={() => switchEdition(comparison ? 'original' : 'comparison')}><Text style={styles.buttonText}>{comparison ? '元の漫画を見る' : '以前の比較用の別版を見る'}</Text></Pressable>}
      {(manga || previousManga) && <Pressable accessibilityRole="button" disabled={working || state?.status === 'running'} style={styles.button} onPress={() => switchEdition(manga ? 'previous-manga' : 'manga')}><Text style={styles.buttonText}>{manga ? '修正前の吹き出し版を見る' : '修正版の漫画を見る'}</Text></Pressable>}
    </View>
    {previousManga && <Text style={styles.text}>修正前の吹き出し版です。保存済みの漫画を比較できます。</Text>}
    {!!state?.script?.generation && <Text style={styles.text}>脚本：{state.script.generation.textModel} ／ 画像：{state.script.generation.imageModel}</Text>}
    {manga && state?.status === 'idle' && <Text style={styles.text}>セリフや説明枠を含む漫画を作ります。以前の版は残ります。初回は画像4枚の生成料金と参考画像の入力料金がかかります。</Text>}
    {comparison && <Text style={styles.text}>以前の比較用の別版です。保存済みの内容は再利用します。</Text>}
    {loading && <ActivityIndicator color={colors.accent} />}
    {state?.status === 'running' ? <View style={styles.card}><ActivityIndicator color={colors.accent} /><Text accessibilityLiveRegion="polite" style={styles.text}>{state.script ? `漫画を描いています（${state.completed} / 4 コマ）` : state.hasScriptDraft ? '保存した脚本案を修正しています…' : '物語の紹介を考えています…'}</Text></View> : state?.status !== 'ready' && state && <Pressable accessibilityRole="button" disabled={working || loading || (state.failure?.code === 'LIMIT' && !state.canResumeRemaining && !state.canResumeScript)} style={styles.primary} onPress={() => void generate()}><Text style={styles.light}>{working ? '準備しています…' : state.canResumeScript ? (state.hasScriptDraft ? '保存した脚本案を修正する' : '脚本を追加で1回試す') : state.canResumeRemaining ? `残り${4 - state.completed}コマを作る` : state.script ? '漫画の作成を再開する' : '紹介漫画を作る'}</Text></Pressable>}
    {state?.canResumeScript && <Text style={styles.text}>追加の脚本生成料金がかかります。脚本が完成すると画像の生成にも進みます。過去の試行回数は残し、1回だけ追加します。</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
    {state?.status === 'error' && <Text accessibilityRole="alert" style={styles.text}>{comicFailureMessage(state.failure?.code, !!state.script, state.completed)}</Text>}
    {(!!error || state?.status === 'error') && <Pressable accessibilityRole="button" disabled={loading || working} style={styles.button} onPress={() => void load()}><Text style={styles.buttonText}>保存状態を確認する</Text></Pressable>}
    {state?.script?.format === 'manga-v2' ? <View style={[styles.mangaPage, { flexDirection: pageWidth >= 620 ? 'row-reverse' : 'column' }]} onLayout={event => setPageWidth(event.nativeEvent.layout.width)}>
      {state.script.panels.slice(0, state.completed).map((panel, index) => <View key={index} style={{ width: pageWidth >= 620 ? '49%' : '100%' }}>
        <MangaPanel panel={panel} index={index} width={pageWidth >= 620 ? pageWidth * 0.49 : pageWidth || 340}><ComicImage comicKey={state.key} index={index + 1} caption={panel.caption} portrait /></MangaPanel>
      </View>)}
    </View> : state?.script?.panels.slice(0, state.completed).map((panel, index) => <View key={index} style={styles.card}>
      <Text style={styles.heading}>{index + 1}コマ目 · {panel.title}</Text>
      <ComicImage comicKey={state.key} index={index + 1} caption={panel.caption} />
      <Text style={styles.text}>{panel.caption}</Text>
    </View>)}
    {state?.status === 'ready' && <Pressable accessibilityRole="button" style={styles.primary} onPress={read}><Text style={styles.light}>原文を読む →</Text></Pressable>}
  </ScrollView>;
}
function ComicImage({ comicKey, index, caption, portrait = false }: { comicKey: string; index: number; caption: string; portrait?: boolean }) {
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  let uri: string;
  try { uri = artifactUrl(`/api/comic?key=${comicKey}&image=${index}&format=webp`); }
  catch { return <Text style={styles.text}>画像の接続先が未設定です。配信設定を確認してください。</Text>; }
  return <View>{failed ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setFailed(false); setRetry(value => value + 1); }}><Text style={styles.buttonText}>保存画像を読み直す</Text></Pressable> : <Image key={retry} source={{ uri, cacheKey: `${comicKey}:${index}:preview-v1` }} onError={() => setFailed(true)} style={[styles.image, portrait && { aspectRatio: 2 / 3 }]} contentFit="contain" cachePolicy="disk" accessibilityLabel={`${index}コマ目：${caption}`} />}</View>;
}
const styles = StyleSheet.create({
  editions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, mangaPage: { backgroundColor: '#fff', padding: 8, gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' },
  body: { padding: 20, paddingBottom: 40, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' }, kicker: { color: colors.accent, fontSize: 12, letterSpacing: 2 }, title: { fontSize: 28, color: colors.ink }, heading: { fontSize: 19, fontWeight: '600', color: colors.ink }, text: { color: colors.ink, fontSize: 16, lineHeight: 28 }, card: { gap: 14, paddingVertical: 12 },
  image: { width: '100%', aspectRatio: 1.5, backgroundColor: colors.surface }, button: { alignSelf: 'flex-start', padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface }, buttonText: { color: colors.accent, fontSize: 15 }, primary: { alignSelf: 'flex-start', backgroundColor: colors.accent, padding: 14, borderRadius: 10 }, light: { color: colors.surface, fontSize: 16 },
});
