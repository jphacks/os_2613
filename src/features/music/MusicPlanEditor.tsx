import { useEffect, useRef, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SavedBook } from '@/features/library/types';
import type { MusicTrack } from '@/server/music.mjs';
import { colors } from '@/shared/theme';
import { bookTextLimit, type MusicPlan, type MusicScene } from './plan-model.mjs';

const moods = [{ id: 'calm', label: '穏やか' }, { id: 'tense', label: '緊張・決意' }, { id: 'sad', label: '悲哀' }, { id: 'bright', label: '希望・安堵' }] as const;
function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: 0.4 }]}><Text style={styles.text}>{label}</Text></Pressable>;
}

export function MusicPlanEditor({ book, visible, onClose }: { book: SavedBook; visible: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState<MusicPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<MusicTrack | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const pending = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (!visible) player.pause(); }, [visible, player]);
  useEffect(() => {
    if (!preview || status.isLoaded) return;
    const timer = setTimeout(() => setError('音源を読み込めません。別の候補で試聴してください。'), 20000);
    return () => clearTimeout(timer);
  }, [preview, status.isLoaded]);

  async function request(action: 'load' | 'analyze' | 'save', value?: MusicPlan) {
    const response = await fetch('/api/music-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.current?.signal,
      body: JSON.stringify({ action, book: { title: book.title, text: book.text }, ...(value ? { plan: value } : {}) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data as { plan: MusicPlan | null; cached?: boolean };
  }
  async function run(label: string, operation: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; controller.current = new AbortController(); setBusy(label); setError(''); setMessage('');
    try { await operation(); }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '操作できませんでした。'); }
    finally { pending.current = false; if (alive.current) setBusy(''); }
  }
  async function load() {
    await run('保存済みを確認中…', async () => {
      const result = await request('load');
      if (alive.current) { setPlan(result.plan); setLoaded(true); setDirty(false); setMessage(result.plan ? '共有ファイルから読み込みました。OpenAIへのリクエストはありません。' : 'まだ選曲案がありません。'); }
    });
  }
  useEffect(() => { if (visible && !loaded && book.text.length <= bookTextLimit) void load(); }, [visible]); // Load only shared files; generation is always a button action.

  function edit(index: number, patch: Partial<MusicScene>) {
    setPlan(current => current ? { ...current, scenes: current.scenes.map((scene, i) => i === index ? { ...scene, ...patch } : scene) } : null);
    setDirty(true); setMessage('');
  }
  async function candidates(scene: MusicScene) {
    const params = new URLSearchParams({ mood: scene.mood, q: scene.query });
    const response = await fetch(`/api/music?${params}`, { signal: controller.current?.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data.tracks as MusicTrack[];
  }
  async function analyze() {
    await run('本文を分析中…', async () => {
      const result = await request('analyze');
      if (!result.plan || !alive.current) return;
      setPlan(result.plan); setLoaded(true); setDirty(false);
      if (result.cached) { setMessage('保存済みの分析を再利用しました。OpenAIは呼んでいません。'); return; }
      setMessage('分析を共有ファイルに保存しました。続けて音楽候補を検索します。');
      // A failed Freesound request never discards the paid analysis.
      let next = { ...result.plan, scenes: [...result.plan.scenes] };
      const reused = new Map<string, MusicTrack[]>();
      for (let index = 0; index < next.scenes.length; index++) {
        if (!alive.current) return;
        setBusy(`候補を検索中… ${index + 1}/${next.scenes.length}`);
        const scene = next.scenes[index], key = `${scene.mood}:${scene.query}`;
        const tracks = reused.get(key) ?? await candidates(scene);
        reused.set(key, tracks);
        next = { ...next, scenes: next.scenes.map((item, i) => i === index ? { ...scene, candidates: tracks, selectedId: tracks[0]?.id ?? null } : item) };
        setPlan(next); setDirty(true);
        const saved = await request('save', next);
        if (!saved.plan || !alive.current) return;
        next = saved.plan; setPlan(next); setDirty(false);
      }
      setMessage('分析と候補を共有ファイルに自動保存しました。試聴・編集後は「選曲案を共有保存」を押してください。');
    });
  }
  async function save() {
    if (!plan) return;
    await run('保存中…', async () => {
      const result = await request('save', plan);
      if (alive.current) { setPlan(result.plan); setDirty(false); setMessage('選曲案を共有ファイルに保存しました。'); }
    });
  }
  async function audition() {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      player.volume = 0.25; player.loop = true; player.play();
    } catch { setError('再生できません。別の候補をお試しください。'); }
  }

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={styles.screen}>
      <View style={styles.row}><Text style={styles.heading}>本文から選曲・編集</Text><Button label="閉じる" onPress={onClose} disabled={!!busy} /></View>
      {preview && <View style={styles.preview}>
        <Text style={styles.text} numberOfLines={1}>試聴：{preview.name} / {preview.creator}</Text>
        <View style={styles.row}><Button label={status.playing ? '試聴を停止' : status.isLoaded ? '試聴を再生' : '音源を読み込み中…'} disabled={!status.isLoaded} onPress={() => status.playing ? player.pause() : void audition()} /><Button label="音源ページ" onPress={() => void Linking.openURL(preview.url)} /><Button label="ライセンス" onPress={() => void Linking.openURL(preview.license)} /></View>
      </View>}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={styles.text}>作品全体の内容を含む編集画面です。読書位置に合わせた自動再生はまだ行いません。</Text>
        {book.text.length > bookTextLimit ? <Text style={styles.error}>本文が60,000文字を超えています。今回は短い作品でお試しください。本文は途中で切り捨てません。</Text> : <>
          <Text style={styles.text}>「本文を分析して音楽取得」を押すと本文全体をOpenAIへ送信します。最大8場面・出力最大4,000トークン。料金が発生します。保存済みの案や候補の探し直しにはOpenAIを使いません。</Text>
          <View style={styles.row}>
            {!plan && <Button label="本文を分析して音楽取得" onPress={() => void analyze()} disabled={!!busy || !loaded} />}
            <Button label="保存済みを読み直す（未保存の編集を破棄）" onPress={() => void load()} disabled={!!busy} />
            {plan && <Button label={dirty ? '選曲案を共有保存（未保存）' : '保存済み'} onPress={() => void save()} disabled={!!busy || !dirty} />}
          </View>
          {!!busy && <Text accessibilityLiveRegion="polite" style={styles.text}>{busy}</Text>}
          {!!message && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {plan && <Text style={styles.text}>保存された分析の使用量：入力 {plan.usage.input}／出力 {plan.usage.output}／計 {plan.usage.total} トークン</Text>}
          {plan?.scenes.map((scene, index) => <View key={index} style={styles.card}>
            <Text style={styles.heading}>場面 {index + 1}（{scene.start + 1}〜{scene.end}文字）</Text>
            <Text style={styles.text}>冒頭：{book.text.slice(scene.start, Math.min(scene.start + 90, scene.end))}</Text>
            <TextInput accessibilityLabel={`場面${index + 1}の名前`} value={scene.label} maxLength={80} editable={!busy} onChangeText={label => edit(index, { label })} style={styles.input} />
            <TextInput accessibilityLabel={`場面${index + 1}の解釈と選曲理由`} value={scene.reason} maxLength={240} multiline editable={!busy} onChangeText={reason => edit(index, { reason })} style={styles.input} />
            <View style={styles.row}>{moods.map(mood => <Button key={mood.id} label={`${scene.mood === mood.id ? '✓ ' : ''}${mood.label}`} onPress={() => edit(index, { mood: mood.id })} disabled={!!busy} />)}</View>
            <Text style={styles.text}>英語の音楽検索語（例：melancholic piano music）</Text>
            <TextInput accessibilityLabel={`場面${index + 1}の検索語`} autoCapitalize="none" autoCorrect={false} value={scene.query} maxLength={100} editable={!busy} onChangeText={query => edit(index, { query })} style={styles.input} />
            <Button label="この検索語で候補を探す（OpenAI不使用）" disabled={!!busy} onPress={() => void run('候補を検索中…', async () => {
              const tracks = await candidates(scene); if (!alive.current) return;
              edit(index, { candidates: tracks, selectedId: tracks[0]?.id ?? null });
              setMessage(tracks.length ? '候補を更新しました。試聴して選び、共有保存してください。' : '一致する音楽がありません。検索語を短くするか、楽器名を変えて再検索してください。');
            })} />
            {!scene.candidates.length && <Text style={styles.text}>候補なし。分析結果は保存されています。上の検索語を編集して探し直せます。</Text>}
            {scene.candidates.map(track => <View key={track.id} style={styles.row}>
              <Button label={`${scene.selectedId === track.id ? '✓ ' : ''}${track.name} / ${track.creator}`} disabled={!!busy} onPress={() => edit(index, { selectedId: track.id })} />
              <Button label="試聴に読み込む" onPress={() => { player.pause(); player.replace({ uri: track.audioUrl }); setPreview(track); setError(''); }} />
            </View>)}
            <Button label="この場面の曲を外す" disabled={!!busy || scene.selectedId === null} onPress={() => edit(index, { selectedId: null })} />
          </View>)}
        </>}
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingTop: 48, paddingBottom: 24 },
  content: { padding: 16, gap: 12 },
  preview: { padding: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingHorizontal: 8 },
  card: { padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface, gap: 8 },
  heading: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  text: { color: colors.ink, fontSize: 13, lineHeight: 21 },
  error: { color: colors.accent, fontSize: 14, lineHeight: 22 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, padding: 10, color: colors.ink, backgroundColor: colors.surface },
  button: { padding: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 8, marginVertical: 3 },
});
