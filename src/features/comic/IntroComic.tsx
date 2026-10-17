import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SavedBook } from '@/features/library/types';
import { documentVersion } from '@/features/bookmark/model.mjs';
import { colors } from '@/shared/theme';
import { comicImageCount, introSource, validateScript, type Script } from './model.mjs';
import { artifactRequest, artifactUrl } from './api';
import { MangaPanel } from './MangaPanel';
function comicNotice(code: string | undefined, completed: number) {
  if (code === 'NETWORK') return '通信が途切れました。接続を確認して、もう一度お試しください。';
  if (code === 'TIMEOUT') return '漫画の作成に時間がかかっています。しばらくしてからもう一度お試しください。';
  if (code === 'RATE_LIMIT' || code === 'BUSY' || code === 'LIMIT') return 'ただいま漫画を作成できません。時間をおいてお試しください。';
  if (code === 'STORAGE') return '漫画を保存できませんでした。時間をおいてもう一度お試しください。';
  return completed > 0 ? '漫画の作成が途中で止まりました。できあがったコマから再開できます。' : '紹介漫画を作成できませんでした。もう一度お試しください。';
}
type State = { key: string; status: 'idle' | 'running' | 'ready' | 'error'; script: Script | null; completed: number; totalImages?: 1 | 4; canResumeRemaining?: boolean; canResumeScript?: boolean; hasScriptDraft?: boolean; failureStage?: 'script' | 'image' | 'storage' | null; failure?: { code: string; error: string } };
function checked(value: State, opening: string): State {
  if (!/^[a-f0-9]{64}$/.test(value?.key) || !['idle', 'running', 'ready', 'error'].includes(value.status) || !Number.isInteger(value.completed) || value.completed < 0 || value.completed > (value.totalImages ?? 4)) throw new Error('保存内容を確認できません。画面を開き直してください。');
  const script = value.script ? validateScript(value.script, opening) : null;
  if (value.totalImages !== undefined && ![1, 4].includes(value.totalImages)) throw new Error('保存内容を確認できません。');
  if (script && comicImageCount(script.generation?.revision) !== (value.totalImages ?? 4)) throw new Error('保存形式を確認できません。');
  if ((!script && value.completed) || (value.status === 'ready' && (!script || value.completed !== (value.totalImages ?? 4)))) throw new Error('保存内容を確認できません。画面を開き直してください。');
  return { ...value, script };
}
export function IntroComic({ book, read }: { book: SavedBook; read: () => void }) {
  if (book.id === 'aozora-1567' && book.aozoraId === 1567) return <MelosComic book={book} read={read} />;
  return <ComicEdition key={book.id} book={book} read={read} />;
}
const melosPanels = [
  { source: require('../../../assets/comics/hashire-melos/1.webp'), description: 'メロスは王の前に引き出され、人を疑い殺す王を問いただす。' },
  { source: require('../../../assets/comics/hashire-melos/2.webp'), description: 'メロスは妹の婚礼のため、三日間の猶予を願う。' },
  { source: require('../../../assets/comics/hashire-melos/3.webp'), description: '王は友を人質に置き、三日目の日暮れまでに戻るよう命じる。' },
  { source: require('../../../assets/comics/hashire-melos/4.webp'), description: 'メロスは親友セリヌンティウスに事情を打ち明け、信頼を託す。' },
];
function MelosComic({ book, read }: { book: SavedBook; read: () => void }) {
  const [pageWidth, setPageWidth] = useState(0);
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.kicker}>物語の入口</Text><Text style={styles.title}>{book.title}</Text><Text style={styles.text}>{book.author}</Text>
    <Text style={styles.heading}>漫画から、読んでみよう。</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={read}><Text style={styles.buttonText}>原文を読む →</Text></Pressable>
    <View style={[styles.mangaPage, { flexDirection: pageWidth >= 620 ? 'row-reverse' : 'column' }]} onLayout={event => setPageWidth(event.nativeEvent.layout.width)}>
      {melosPanels.map((panel, index) => <Image key={index} source={panel.source} style={{ width: pageWidth >= 620 ? '49%' : '100%', aspectRatio: 3 / 4 }} contentFit="contain" cachePolicy="disk" accessibilityLabel={`${index + 1}コマ目：${panel.description}`} />)}
    </View>
    <Pressable accessibilityRole="button" style={styles.primary} onPress={read}><Text style={styles.light}>原文を読む →</Text></Pressable>
  </ScrollView>;
}
function ComicEdition({ book, read }: { book: SavedBook; read: () => void }) {
  const source = useMemo(() => introSource(book.text, book.title), [book.text, book.title]);
  const cacheKey = `dopabooks:comic:manga:v4:${book.id}:${documentVersion(JSON.stringify({ title: book.title, ...source }))}`;
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
      const value = await artifactRequest('/api/comic', { action: 'register', bookId: book.id, title: book.title, ...source, edition: 'manga', revision: 4 }, controller.signal);
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
    catch { if (active.current) setError('漫画の作成状況を確認できませんでした。通信を確認し、もう一度読み込んでください。'); }
    finally { clearTimeout(timer); if (active.current) setWorking(false); }
  }
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.kicker}>物語の入口</Text><Text style={styles.title}>{book.title}</Text><Text style={styles.text}>{book.author}</Text>
    <Text style={styles.heading}>漫画から、読んでみよう。</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={read}><Text style={styles.buttonText}>原文を読む →</Text></Pressable>
    {state?.status === 'idle' && <Text style={styles.text}>物語のはじまりを、4コマの漫画でのぞいてみませんか。</Text>}
    {loading && <ActivityIndicator color={colors.accent} />}
    {state?.status === 'running' ? <View style={styles.card}><ActivityIndicator color={colors.accent} /><Text accessibilityLiveRegion="polite" style={styles.text}>{state.script ? `漫画を描いています（${state.completed} / 4 コマ）` : '物語の紹介を考えています…'}</Text></View> : state?.status !== 'ready' && state && <Pressable accessibilityRole="button" disabled={working || loading || (state.failure?.code === 'LIMIT' && !state.canResumeRemaining && !state.canResumeScript)} style={styles.primary} onPress={() => void generate()}><Text style={styles.light}>{working ? '準備しています…' : state.script ? '漫画の作成を再開する' : state.status === 'error' ? 'もう一度作る' : '紹介漫画を作る'}</Text></Pressable>}
    {!!error && <Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
    {state?.status === 'error' && <Text accessibilityRole="alert" style={styles.text}>{comicNotice(state.failure?.code, state.completed)}</Text>}
    {(!!error || state?.status === 'error') && <Pressable accessibilityRole="button" disabled={loading || working} style={styles.button} onPress={() => void load()}><Text style={styles.buttonText}>もう一度読み込む</Text></Pressable>}
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
  mangaPage: { backgroundColor: '#fff', padding: 8, gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' },
  body: { padding: 20, paddingBottom: 40, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' }, kicker: { color: colors.accent, fontSize: 12, letterSpacing: 2 }, title: { fontSize: 28, color: colors.ink }, heading: { fontSize: 19, fontWeight: '600', color: colors.ink }, text: { color: colors.ink, fontSize: 16, lineHeight: 28 }, card: { gap: 14, paddingVertical: 12 },
  image: { width: '100%', aspectRatio: 1.5, backgroundColor: colors.surface }, button: { alignSelf: 'flex-start', padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface }, buttonText: { color: colors.accent, fontSize: 15 }, primary: { alignSelf: 'flex-start', backgroundColor: colors.accent, padding: 14, borderRadius: 10 }, light: { color: colors.surface, fontSize: 16 },
});
