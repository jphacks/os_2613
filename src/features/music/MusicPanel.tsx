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

const fallback = require('../../../assets/audio/reading-pad.wav');
export function MusicPanel({ book, position, guideActive }: { book: SavedBook; position: number; guideActive: boolean }) {
  const [plan, setPlan] = useState<MusicPlan | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [volume, setVolume] = useState(0.25);
  const [volumeReady, setVolumeReady] = useState(false);
  const first = useAudioPlayer(fallback), second = useAudioPlayer(fallback), bed = useAudioPlayer(fallback);
  const mixer = useMemo(() => new ContinuousMixer([first, second, bed], fallback, setNotice), [first, second, bed]);
  const alive = useRef(true);
  const preparing = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; requestController.current?.abort(); mixer.stop(); }; }, [mixer]);
  useEffect(() => {
    const interval = setInterval(() => mixer.tick(), 80);
    return () => clearInterval(interval);
  }, [mixer]);
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
  const stop = useCallback(() => { mixer.stop(); setEnabled(false); }, [mixer]);
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
        if (data.plan?.version === 1) setNotice('BGM取得で環境音優先の選曲に更新します（今回のみAI分析）。');
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
      setNotice(missing ? '選曲を保存しました。曲のない場面は直前の曲・予備BGMでつなぎます。' : result.cached ? '保存済みの選曲を適用しました。再分析はしていません。' : '選曲・ミックス設定を自動保存しました。');
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '音楽を取得できません。'); }
    finally { preparing.current = false; if (alive.current) setBusy(false); }
  }
  function start() {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => setError('音声設定を変更できません。端末の音量をご確認ください。'));
    mixer.arm(); setEnabled(true); setNotice('');
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={[styles.button, disabled && { opacity: 0.4 }]}><Text style={styles.text}>{label}</Text></Pressable>;
  return <View style={styles.panel}>
    <View style={styles.row}>{button(enabled ? 'BGM ON' : 'BGM OFF', enabled ? stop : start, !plan)}{button(busy ? 'BGM取得中…' : 'BGM取得', () => void load(), busy)}</View>
    <VolumeBar value={volume} onChange={setVolume} />
    <View style={[styles.row, { flexWrap: 'nowrap' }]}>
      <Text style={[styles.text, { flex: 1 }]} numberOfLines={1}>ガイドに自動同期・{current ? <Text accessibilityRole="link" onPress={() => void Linking.openURL(current.url)}>{current.creator} / {current.name}</Text> : '同梱の予備BGM'}</Text>
      {current && <Text style={styles.text} accessibilityRole="link" onPress={() => void Linking.openURL(current.license)}>{current.license.includes('/zero/') ? 'CC0' : 'CC BY'}</Text>}
    </View>
    <Text accessibilityLiveRegion="polite" numberOfLines={3} style={[styles.text, { height: 54 }]}>{error || (enabled && !guideActive ? 'ガイドをONにすると、読んでいる位置の音が鳴ります。' : notice) || (plan?.version === 2 ? '環境音を優先した選曲を保存済み。ガイドに自動で合わせます。' : '環境音優先・初回のBGM取得は本文をAI分析します（有料）。')}</Text>
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, padding: 6, borderBottomWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  button: { padding: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 8, marginVertical: 2 },
  text: { color: colors.ink, fontSize: 12, lineHeight: 18 },
});
