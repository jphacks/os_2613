import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import type { SavedBook } from '@/features/library/types';
import type { MusicPlan } from './plan-model.mjs';
import { prepareMusic } from './prepare.mjs';
import { ContinuousMixer, musicAt } from './playback.mjs';
import { VolumeBar } from './VolumeBar';
import { CueMixer } from './cue-playback.mjs';
import type { MusicTrack } from '@/server/music.mjs';

const fallback = require('../../../assets/audio/reading-pad.wav');
export function MusicPanel({ book, position, guideActive, visible = true }: { visible?: boolean; book: SavedBook; position: number; guideActive: boolean }) {
  const [plan, setPlan] = useState<MusicPlan | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [volume, setVolume] = useState(0.25);
  const [volumeReady, setVolumeReady] = useState(false);
  const [activeCues, setActiveCues] = useState<MusicTrack[]>([]);
  const first = useAudioPlayer(fallback), second = useAudioPlayer(fallback), bed = useAudioPlayer(fallback);
  const layerA = useAudioPlayer(null), layerB = useAudioPlayer(null), effectA = useAudioPlayer(null), effectB = useAudioPlayer(null);
  const cueMixer = useMemo(() => new CueMixer([layerA, layerB, effectA, effectB], setActiveCues), [layerA, layerB, effectA, effectB]);
  const mixer = useMemo(() => new ContinuousMixer([first, second, bed], fallback, setNotice), [first, second, bed]);
  const alive = useRef(true);
  const preparing = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; requestController.current?.abort(); mixer.stop(); cueMixer.stop(); }; }, [mixer, cueMixer]);
  useEffect(() => {
    const interval = setInterval(() => { cueMixer.tick(); mixer.setDucking(cueMixer.hasEffects ? 0.6 : 1); mixer.tick(); }, 80);
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
        setPlan(data.plan);
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
  useEffect(() => { mixer.request(current ? String(current.id) : 'fallback', current ? { uri: current.audioUrl } : fallback); }, [current?.id, current?.audioUrl, mixer]);
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
      const missing = result.plan.scenes.some(scene => scene.selectedId === null);
      const effects = (result.plan.cues ?? []).filter(cue => cue.selectedId !== null).length;
      setNotice(missing ? `選曲・効果音${effects}件を保存しました。音のない場面は予備BGMでつなぎます。` : `選曲・効果音${effects}件を${result.cached ? '再利用' : '自動保存'}しました。`);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '音楽を取得できません。'); }
    finally { preparing.current = false; if (alive.current) setBusy(false); }
  }
  function start() {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => setError('音声設定を変更できません。端末の音量をご確認ください。'));
    mixer.arm(); cueMixer.arm(); setEnabled(true); setNotice('');
  }
  if (!visible) return null;
  const icon = (symbol: string, label: string, action: () => void, disabled = false, active = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={action} style={[styles.button, active && styles.active, disabled && { opacity: 0.35 }]}><Text style={[styles.symbol, active && styles.light]}>{symbol}</Text></Pressable>;
  return <View style={styles.panel}>
    <View style={styles.row}>
      {icon('♫', enabled ? 'BGMをオフにする' : 'BGMをオンにする（読みガイドに同期）', enabled ? stop : start, !plan, enabled)}
      {busy ? <View style={styles.button} accessibilityLabel="BGM取得中"><ActivityIndicator size="small" color={colors.accent} /></View> : icon('↓', 'BGMを取得（初回は有料AI分析）', () => void load())}
      <View style={styles.volume}><VolumeBar value={volume} onChange={setVolume} /></View>
      {icon(error ? '!' : 'ⓘ', 'BGMの情報・音源クレジット', () => setDetails(true))}
    </View>
    {!!error && <Pressable onPress={() => setDetails(true)}><Text accessibilityRole="alert" style={styles.text} numberOfLines={1}>{error}</Text></Pressable>}
    <Modal visible={details} transparent animationType="fade" onRequestClose={() => setDetails(false)}>
      <View style={styles.backdrop}><View style={styles.card}><ScrollView contentContainerStyle={styles.details}>
        <Text style={styles.heading}>BGM</Text>
        <Text style={styles.text}>{error || notice || '読みガイドに合わせて再生します。初回取得は本文をAI分析します（有料）。'}</Text>
        <Text style={styles.text}>{enabled && !guideActive ? '読みガイドを開始すると音が鳴ります。' : '環境音・効果音は本文の該当箇所で重なります。'}</Text>
        {[...(current ? [current] : []), ...activeCues].map((track, index) => <View key={`${track.id}:${index}`} style={styles.credit}><Text accessibilityRole="link" onPress={() => void Linking.openURL(track.url)} style={styles.text}>{track.creator} / {track.name}</Text><Text accessibilityRole="link" onPress={() => void Linking.openURL(track.license)} style={styles.text}>{track.license.includes('/zero/') ? 'CC0' : 'CC BY'}</Text></View>)}
        {!current && <Text style={styles.text}>同梱の予備BGM</Text>}
        <Pressable accessibilityRole="button" onPress={() => setDetails(false)} style={styles.close}><Text style={styles.text}>閉じる</Text></Pressable>
      </ScrollView></View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  panel: { paddingHorizontal: 12, paddingVertical: 3 },
  row: { flexDirection: 'row', gap: 4, alignItems: 'center', alignSelf: 'flex-end', width: '100%', maxWidth: 360 },
  button: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.accent }, light: { color: colors.surface },
  symbol: { color: colors.accent, fontSize: 22 },
  volume: { flex: 1 },
  text: { color: colors.ink, fontSize: 12, lineHeight: 20 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(41,46,41,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: colors.surface, borderRadius: 14 },
  details: { padding: 22, gap: 16 }, credit: { gap: 4 }, close: { alignSelf: 'flex-end', padding: 8 },
});
