import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import type { SavedBook } from '@/features/library/types';
import type { MusicPlan } from './plan-model.mjs';
import { prepareMusic } from './prepare.mjs';
import { ContinuousMixer, musicAt } from './playback.mjs';
import { VolumeBar } from './VolumeBar';
import { CueMixer } from './cue-playback.mjs';
import type { MusicTrack } from '@/server/music.mjs';

const fallback = require('../../../assets/audio/reading-pad.wav');
export function MusicPanel({ book, position, guideActive }: { book: SavedBook; position: number; guideActive: boolean }) {
  const [plan, setPlan] = useState<MusicPlan | null>(null);
  const [enabled, setEnabled] = useState(false);
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
  useEffect(() => { cueMixer.update(plan?.cues ?? [], position, enabled && guideActive && !!plan, volume); }, [plan, position, enabled, guideActive, volume, cueMixer]);
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
    if (enabled && guideActive && plan) mixer.start();
    else mixer.stop();
  }, [enabled, guideActive, !!plan, mixer]);
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
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={[styles.button, disabled && { opacity: 0.4 }]}><Text style={styles.text}>{label}</Text></Pressable>;
  return <View style={styles.panel}>
    <View style={styles.row}>{button(enabled ? 'BGM ON' : 'BGM OFF', enabled ? stop : start, !plan)}{button(busy ? 'BGM取得中…' : 'BGM取得', () => void load(), busy)}</View>
    <VolumeBar value={volume} onChange={setVolume} />
    <View style={[styles.row, { flexWrap: 'nowrap' }]}>
      <Text style={[styles.text, { flex: 1 }]} numberOfLines={1}>ガイドに自動同期・{current ? <Text accessibilityRole="link" onPress={() => void Linking.openURL(current.url)}>{current.creator} / {current.name}</Text> : '同梱の予備BGM'}</Text>
      {current && <Text style={styles.text} accessibilityRole="link" onPress={() => void Linking.openURL(current.license)}>{current.license.includes('/zero/') ? 'CC0' : 'CC BY'}</Text>}
    </View>
    <Text style={[styles.text, { height: 36 }]} numberOfLines={2}>{activeCues.length ? activeCues.map(track => <Text key={track.id}><Text accessibilityRole="link" onPress={() => void Linking.openURL(track.url)}>{track.creator} / {track.name}</Text> <Text accessibilityRole="link" onPress={() => void Linking.openURL(track.license)}>{track.license.includes('/zero/') ? 'CC0' : 'CC BY'}</Text>　</Text>) : '環境音・効果音は、本文の該当箇所で重なります。'}</Text>
    <Text accessibilityLiveRegion="polite" numberOfLines={3} style={[styles.text, { height: 54 }]}>{error || (enabled && !guideActive ? 'ガイドをONにすると、読んでいる位置の音が鳴ります。' : notice) || (plan?.version === 3 ? '環境音・効果音を保存済み。ガイドに自動で合わせます。' : '環境音・効果音の初回取得は本文をAI分析します（有料）。')}</Text>
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, padding: 6, borderBottomWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  button: { padding: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 8, marginVertical: 2 },
  text: { color: colors.ink, fontSize: 12, lineHeight: 18 },
});
