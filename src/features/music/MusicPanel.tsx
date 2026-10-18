import { AppIcon } from '@/shared/AppIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { ActivityIndicator, AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '@/shared/theme';
import { readerToolButton, readerToolSymbol } from '@/features/reader/toolStyles';
import type { SavedBook } from '@/features/library/types';
import type { MusicPlan } from './plan-model.mjs';
import { prepareMusic } from './prepare.mjs';
import { ContinuousMixer, musicAt, sceneIntensity } from './playback.mjs';
import { VolumeBar } from './VolumeBar';
import { CueMixer } from './cue-playback.mjs';
import type { MusicTrack } from '@/server/music.mjs';
import Constants from 'expo-constants';
import { audioSource } from './audio-source.mjs';
import { anchorLegacyScenes } from './music-timing.mjs';
import { StudyMusic } from './StudyMusic';

const fallback = require('../../../assets/audio/reading-pad.wav');
export function MusicPanel({ book, position, guideActive, visible = true, detailsOpen, onDetailsChange, onGuidePress }: { visible?: boolean; book: SavedBook; position: number; guideActive: boolean; detailsOpen?: boolean; onDetailsChange?: (open: boolean) => void; onGuidePress?: () => void }) {
  const [plan, setPlan] = useState<MusicPlan | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [localDetails, setLocalDetails] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [studyMusicOpen, setStudyMusicOpen] = useState(false);
  const details = detailsOpen ?? localDetails;
  const setDetails = (open: boolean) => { setLocalDetails(open); onDetailsChange?.(open); };
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [volume, setVolume] = useState(0.25);
  const [volumeReady, setVolumeReady] = useState(false);
  const [activeCues, setActiveCues] = useState<MusicTrack[]>([]);
  const audioOrigin = Platform.OS === 'web' ? '' : process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? (Constants.expoConfig?.hostUri ? `http://${Constants.expoConfig.hostUri}` : '');
  const sourceFor = useCallback((track: MusicTrack) => Platform.OS !== 'web' && !audioOrigin ? { uri: track.audioUrl } : audioSource(track, audioOrigin), [audioOrigin]);
  const first = useAudioPlayer(fallback), second = useAudioPlayer(fallback), bed = useAudioPlayer(fallback);
  const layerA = useAudioPlayer(null), layerB = useAudioPlayer(null), effectA = useAudioPlayer(null), effectB = useAudioPlayer(null);
  const cueMixer = useMemo(() => new CueMixer([layerA, layerB, effectA, effectB], setActiveCues, undefined, sourceFor), [layerA, layerB, effectA, effectB, sourceFor]);
  const mixer = useMemo(() => new ContinuousMixer([first, second, bed], fallback, setNotice), [first, second, bed]);
  const alive = useRef(true);
  const preparing = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; requestController.current?.abort(); mixer.stop(); cueMixer.stop(); }; }, [mixer, cueMixer]);
  useEffect(() => {
    const interval = setInterval(() => { cueMixer.tick(); mixer.setDucking(cueMixer.ducking); mixer.tick(); }, 80);
    return () => clearInterval(interval);
  }, [mixer, cueMixer]);
  useEffect(() => { cueMixer.update(plan?.cues ?? [], position, visible && enabled && guideActive && !!plan, volume); }, [plan, position, enabled, guideActive, visible, volume, cueMixer]);
  useEffect(() => {
    void AsyncStorage.getItem('dopabooks:music-volume:v1').then(raw => {
      if (alive.current && raw !== null && Number.isFinite(Number(raw))) setVolume(Math.max(0, Math.min(1, Number(raw))));
    }).catch(() => {}).finally(() => { if (alive.current) setVolumeReady(true); });
  }, []);
  useEffect(() => {
    mixer.setVolume(volume);
    if (!volumeReady) return;
    const timer = setTimeout(() => { void AsyncStorage.setItem('dopabooks:music-volume:v1', String(volume)).catch(() => {}); }, 300);
    return () => clearTimeout(timer);
  }, [volume, volumeReady, mixer]);
  const stop = useCallback(() => { mixer.stop(); cueMixer.stop(); setEnabled(false); }, [mixer, cueMixer]);
  useFocusEffect(useCallback(() => stop, [stop]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => subscription.remove();
  }, [stop]);
  async function loadPlan() {
    if (book.text.length > 60000) return;
    try {
      const response = await fetch('/api/music-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'load', book: { title: book.title, text: book.text } }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (alive.current && !preparing.current) {
        setPlan(data.plan ? anchorLegacyScenes(data.plan, book.text) : null);
        if (data.plan && data.plan.version < 3) setNotice('BGM取得で、場面ごとの環境音・効果音を追加します（今回のみAI分析）。');
      }
    } catch { if (alive.current) setNotice('保存済み選曲を読めません。予備BGMは再生できます。'); }
  }
  useEffect(() => { void loadPlan(); }, [book.id, book.text]);
  useEffect(() => {
    if (visible && enabled && guideActive && plan) mixer.start();
    else mixer.stop();
  }, [enabled, guideActive, visible, !!plan, mixer]);
  const current = musicAt(plan?.scenes ?? [], position);
  const scene = plan?.scenes.find(item => item.start <= position && position < item.end);
  useEffect(() => { mixer.setIntensity(sceneIntensity(scene)); }, [scene?.mood, scene?.kind, mixer]);
  useEffect(() => { mixer.request(current ? String(current.id) : 'fallback', current ? sourceFor(current) : fallback); }, [current?.id, current?.audioUrl, current?.kind, sourceFor, mixer]);
  useEffect(() => {
    if (!visible || !enabled || !guideActive) return;
    const next = plan?.scenes.find(item => item.start > position && item.start - position <= 400 && item.selectedId !== null && item.selectedId !== current?.id);
    const track = next?.candidates.find(item => item.id === next.selectedId);
    if (track) mixer.preload(String(track.id), sourceFor(track));
  }, [plan, position, current?.id, mixer, enabled, guideActive, visible, sourceFor]);
  async function load() {
    if (preparing.current) return;
    preparing.current = true;
    requestController.current = new AbortController();
    setBusy(true); setError('');
    setNotice('BGMを準備しています。初回のみ本文をOpenAIで分析します。');
    try {
      const result = await prepareMusic(book, { signal: requestController.current.signal,
        onPlan: value => { if (alive.current) setPlan(value); },
        onProgress: value => { if (alive.current) setNotice(value); },
      });
      if (!alive.current) return;
      const missingScenes = result.plan.scenes.filter(scene => scene.selectedId === null);
      const effects = (result.plan.cues ?? []).filter(cue => cue.selectedId !== null).length;
      const missingCues = (result.plan.cues ?? []).filter(cue => cue.selectedId === null);
      setNotice((missingScenes.length ? `選曲・効果音${effects}件を保存しました。音源が見つからない場面は予備BGMでつなぎます。` : `選曲・効果音${effects}件を${result.cached ? '再利用' : '自動保存'}しました。`)
        + (missingScenes.length ? ` 未取得の場面：${missingScenes.slice(0, 3).map(scene => scene.label).join('・')}。BGM取得で再検索できます。` : '')
        + (missingCues.length ? ` 未取得の効果音：${missingCues.slice(0, 3).map(cue => cue.label).join('・')}。BGM取得で再検索できます。` : ''));
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '音楽を取得できません。'); }
    finally { preparing.current = false; if (alive.current) setBusy(false); }
  }
  function start() {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => setError('音声設定を変更できません。端末の音量をご確認ください。'));
    mixer.arm(); cueMixer.arm(); setEnabled(true); setNotice('');
  }
  if (!visible) return null;
  const OptionsHost = Platform.OS === 'web' ? View : Modal;
  const icon = (symbol: string, label: string, action: () => void, disabled = false, active = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={action} style={[styles.button, active && styles.active, disabled && { opacity: 0.35 }]}>{symbol === '♫' ? <AppIcon name="music_note" size={28} color={active ? colors.surface : colors.accent} /> : <Text style={[styles.symbol, active && styles.light]}>{symbol}</Text>}</Pressable>;
  return <View style={styles.panel}>
    <StudyMusic hideTrigger open={studyMusicOpen} onOpenChange={setStudyMusicOpen} interrupted={enabled} onPlay={stop} />
    {icon('♫', 'BGMの設定を開く', () => setDetails(!details), false, enabled)}
    {details && <OptionsHost transparent visible animationType="none" pointerEvents="box-none" style={Platform.OS === 'web' ? StyleSheet.absoluteFill : undefined} onRequestClose={() => setDetails(false)}>
      {Platform.OS !== 'web' && <View style={{ flexDirection: 'row', marginTop: insets.top + 64, marginLeft: 12 }}>{icon('♫', 'BGM設定を閉じる', () => setDetails(false))}{onGuidePress && icon('≋', '読みガイドへ切り替え', onGuidePress)}</View>}
      <View style={[styles.backdrop, { width: Math.min(300, width - 24) }, Platform.OS !== 'web' && { top: insets.top + 108, left: 12 }]}><View style={[styles.card, Platform.OS !== 'web' && { maxHeight: Math.max(80, Math.min(340, height - insets.top - 108 - Math.max(insets.bottom, 12))) }]}><ScrollView contentContainerStyle={styles.details}>
        <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="BGM設定を閉じる" onPress={() => setDetails(false)} style={styles.button}><AppIcon name="arrow_back" /></Pressable><Text style={styles.heading}>BGM</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="集中BGMを選ぶ" onPress={() => { setDetails(false); setStudyMusicOpen(true); }} style={styles.control}><Text style={styles.text}>♪ 集中BGMを選ぶ</Text><Text style={styles.text}>集中BGM 1・集中BGM 2</Text></Pressable>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={enabled ? stop : start} style={[styles.control, enabled && styles.active]}><Text style={[styles.text, enabled && styles.light]}>{enabled ? 'BGM ON' : 'BGM OFF'}</Text></Pressable>
      {busy ? <View style={styles.button} accessibilityLabel="BGM取得中"><ActivityIndicator size="small" color={colors.accent} /></View> : <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.control}><Text style={styles.text}>BGM取得</Text></Pressable>}
      <View style={styles.volume}><VolumeBar value={volume} onChange={setVolume} /></View>
      {icon(error ? '!' : 'ⓘ', 'BGMの情報・音源クレジット', () => setInfoOpen(!infoOpen))}
    </View>
    {!!error && <Pressable onPress={() => setDetails(true)}><Text accessibilityRole="alert" style={styles.text} numberOfLines={1}>{error}</Text></Pressable>}

        {infoOpen && <View style={{ gap: 12 }}>
        <Text style={styles.text}>{error || notice || '読みガイドに合わせて再生します。初回取得は本文をAI分析します（有料）。'}</Text>
        <Text style={styles.text}>{enabled && !guideActive ? '読みガイドを開始すると音が鳴ります。' : '環境音・効果音は本文の該当箇所で重なります。'}</Text>
        {[...(current ? [current] : []), ...activeCues].map((track, index) => <View key={`${track.id}:${index}`} style={styles.credit}><Text accessibilityRole="link" onPress={() => void Linking.openURL(track.url)} style={styles.text}>{track.creator} / {track.name}</Text><Text accessibilityRole="link" onPress={() => void Linking.openURL(track.license)} style={styles.text}>{track.license.includes('/zero/') ? 'CC0' : 'CC BY'}</Text></View>)}
        {!current && <Text style={styles.text}>同梱の予備BGM</Text>}
        </View>}
      </ScrollView></View></View></OptionsHost>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { padding: 0, zIndex: 50 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', alignSelf: 'flex-end', width: '100%', maxWidth: 360 },
  control: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.button },
  button: readerToolButton,
  active: { backgroundColor: colors.accent }, light: { color: colors.surface },
  symbol: readerToolSymbol,
  volume: { flex: 1 },
  text: { color: colors.ink, fontSize: 12, lineHeight: 20 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  backdrop: { position: 'absolute', top: 44, left: -68, backgroundColor: 'transparent' },
  card: { width: '100%', maxWidth: 300, maxHeight: 340, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  details: { padding: 22, gap: 16 }, credit: { gap: 4 }, close: { alignSelf: 'flex-end', padding: 8 },
});
