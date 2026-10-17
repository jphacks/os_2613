import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SavedBook } from '@/features/library/types';
import { documentVersion } from '@/features/bookmark/model.mjs';
import { colors } from '@/shared/theme';
import { comicFailureMessage, introSource, validateScript, type Script } from './model.mjs';
import { artifactRequest, artifactUrl } from './api';
type State = { key: string; status: 'idle' | 'running' | 'ready' | 'error'; script: Script | null; completed: number; canResumeRemaining?: boolean; failure?: { code: string; error: string } };
function checked(value: State, opening: string): State {
  if (!/^[a-f0-9]{64}$/.test(value?.key) || !['idle', 'running', 'ready', 'error'].includes(value.status) || !Number.isInteger(value.completed) || value.completed < 0 || value.completed > 4) throw new Error('保存内容を確認できません。画面を開き直してください。');
  const script = value.script ? validateScript(value.script, opening) : null;
  if ((!script && value.completed) || (value.status === 'ready' && (!script || value.completed !== 4))) throw new Error('保存内容を確認できません。画面を開き直してください。');
  return { ...value, script };
}
export function IntroComic({ book, read }: { book: SavedBook; read: () => void }) {
  const source = useMemo(() => introSource(book.text, book.title), [book.text, book.title]);
  const cacheKey = `dopabooks:comic:v1:${book.id}:${documentVersion(JSON.stringify({ title: book.title, ...source }))}`;
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
      const value = await artifactRequest('/api/comic', { action: 'register', bookId: book.id, title: book.title, ...source }, controller.signal);
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
    try { await remember(await artifactRequest('/api/comic', { action: 'start', key: state.key, ...(state.canResumeRemaining ? { resumeRemaining: true } : {}) }, controller.signal)); }
    catch (reason) { if (active.current) setError(reason instanceof Error && reason.name !== 'AbortError' ? reason.message : '通信が中断しました。保存状態を確認してください。'); }
    finally { clearTimeout(timer); if (active.current) setWorking(false); }
  }
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.kicker}>物語の入口</Text><Text style={styles.title}>{book.title}</Text><Text style={styles.text}>{book.author}</Text>
    <Text style={styles.heading}>4コマから、読んでみよう。</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={read}><Text style={styles.buttonText}>原文を読む →</Text></Pressable>
    {loading && <ActivityIndicator color={colors.accent} />}
    {state?.status === 'running' ? <View style={styles.card}><ActivityIndicator color={colors.accent} /><Text accessibilityLiveRegion="polite" style={styles.text}>{state.script ? `漫画を描いています（${state.completed} / 4 コマ）` : '物語の紹介を考えています…'}</Text></View> : state?.status !== 'ready' && state && <Pressable accessibilityRole="button" disabled={working || loading || (state.failure?.code === 'LIMIT' && !state.canResumeRemaining)} style={styles.primary} onPress={() => void generate()}><Text style={styles.light}>{working ? '準備しています…' : state.canResumeRemaining ? `残り${4 - state.completed}コマを作る` : state.script ? '漫画の作成を再開する' : '紹介漫画を作る'}</Text></Pressable>}
    {!!error && <Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
    {state?.status === 'error' && <Text accessibilityRole="alert" style={styles.text}>{comicFailureMessage(state.failure?.code, !!state.script, state.completed)}</Text>}
    {(!!error || state?.status === 'error') && <Pressable accessibilityRole="button" disabled={loading || working} style={styles.button} onPress={() => void load()}><Text style={styles.buttonText}>保存状態を確認する</Text></Pressable>}
    {state?.script?.panels.slice(0, state.completed).map((panel, index) => <View key={index} style={styles.card}>
      <Text style={styles.heading}>{index + 1}コマ目 · {panel.title}</Text>
      <ComicImage comicKey={state.key} index={index + 1} caption={panel.caption} />
      <Text style={styles.text}>{panel.caption}</Text>
    </View>)}
    {state?.status === 'ready' && <Pressable accessibilityRole="button" style={styles.primary} onPress={read}><Text style={styles.light}>原文を読む →</Text></Pressable>}
  </ScrollView>;
}
function ComicImage({ comicKey, index, caption }: { comicKey: string; index: number; caption: string }) {
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  let uri: string;
  try { uri = artifactUrl(`/api/comic?key=${comicKey}&image=${index}&format=webp`); }
  catch { return <Text style={styles.text}>画像の接続先が未設定です。配信設定を確認してください。</Text>; }
  return <View>{failed ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setFailed(false); setRetry(value => value + 1); }}><Text style={styles.buttonText}>保存画像を読み直す</Text></Pressable> : <Image key={retry} source={{ uri, cacheKey: `${comicKey}:${index}:preview-v1` }} onError={() => setFailed(true)} style={styles.image} contentFit="contain" cachePolicy="disk" accessibilityLabel={`${index}コマ目：${caption}`} />}</View>;
}
const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' }, kicker: { color: colors.accent, fontSize: 12, letterSpacing: 2 }, title: { fontSize: 28, color: colors.ink }, heading: { fontSize: 19, fontWeight: '600', color: colors.ink }, text: { color: colors.ink, fontSize: 16, lineHeight: 28 }, card: { gap: 14, paddingVertical: 12 },
  image: { width: '100%', aspectRatio: 1.5, backgroundColor: colors.surface }, button: { alignSelf: 'flex-start', padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface }, buttonText: { color: colors.accent, fontSize: 15 }, primary: { alignSelf: 'flex-start', backgroundColor: colors.accent, padding: 14, borderRadius: 10 }, light: { color: colors.surface, fontSize: 16 },
});
