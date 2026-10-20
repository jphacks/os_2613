import { VerticalCarousel } from '@/shared/VerticalCarousel';
import { ReaderPanel, usePhoneReaderPanel } from '@/shared/ReaderPanel';
import type { ReactNode } from 'react';
import { SpeakerButton } from './SpeakerButton';
import { useAccount } from '@/features/account/AccountProvider';
import { StudyToolPanel } from '@/features/study/StudyToolPanel';
import { AppIcon } from '@/shared/AppIcon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors } from '@/shared/theme';
import { readerToolButton, readerToolSymbol, readerPanelHeader, readerPanelTitle } from '@/features/reader/toolStyles';
import { VolumeBar } from './VolumeBar';
import { studyTracks } from './study-tracks';

export function StudyMusic({ open: externalOpen, onOpenChange, hideTrigger = false, embedded = false, controlsOnly = false, onControls, interrupted = false, onPlay }: { open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean; embedded?: boolean; controlsOnly?: boolean; onControls?: (controls: ReactNode) => void; interrupted?: boolean; onPlay?: () => void } = {}) {
  const phoneSheet = usePhoneReaderPanel();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const { complete, prefs } = useAccount();
  const [localOpen, setLocalOpen] = useState(false);
  const open = externalOpen ?? localOpen;
  const setOpen = useCallback((value: boolean) => { setLocalOpen(value); onOpenChange?.(value); }, [onOpenChange]);
  const [selected, setSelected] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.3);
  useEffect(() => {
    if (status.playing && !status.isBuffering && volume > 0 && !prefs.done.includes('music')) complete('music');
  }, [status.playing, status.isBuffering, volume, prefs.done, complete]);
  const [loop, setLoop] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const loadedTrack = useRef<string | null>(null);
  const wanted = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const audioMode = useRef<Promise<void> | null>(null);
  function pause() { wanted.current = false; setEnabled(false); request.current++; player.pause(); }
  const stop = useCallback(() => { wanted.current = false; setEnabled(false); request.current++; player.pause(); setOpen(false); }, [player, setOpen]);
  const latestStop = useRef(stop); latestStop.current = stop;
  // 親の再描画でコールバックが変わっても、画面を離れるまでは停止しない。
  useFocusEffect(useCallback(() => () => latestStop.current(), []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => subscription.remove();
  }, [stop]);
  useEffect(() => { player.volume = volume; player.loop = loop; }, [player, volume, loop]);
  useEffect(() => { if (interrupted) { wanted.current = false; setEnabled(false); request.current++; player.pause(); } }, [interrupted, player]);

  async function play(id: string) {
    const track = studyTracks.find(item => item.id === id);
    if (!track) return;
    const token = ++request.current;
    wanted.current = true; setEnabled(true);
    if (id !== loadedTrack.current) player.pause();
    setSelected(id); setError('');
    if (track.source === null) {
      wanted.current = false; setEnabled(false);
      setError('この曲は準備中です。音源の追加後に、もう一度選んでください。');
      return;
    }
    try {
      // 毎回音声セッションを設定し直さず、最初の一回だけ準備する。
      if (!audioMode.current) audioMode.current = setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(reason => { audioMode.current = null; throw reason; });
      await audioMode.current;
      if (token !== request.current) return;
      if (id !== loadedTrack.current || status.error) { player.replace(track.source); loadedTrack.current = id; }
      onPlay?.();
      player.loop = loop; player.volume = volume; player.play();
    } catch {
      if (token === request.current) { wanted.current = false; setEnabled(false); setError('再生できません。音源と端末の音声設定を確認して、再生し直してください。'); }
    }
  }
  useEffect(() => {
    if (status.error || (status.didJustFinish && !loop)) { wanted.current = false; setEnabled(false); }
  }, [status.error, status.didJustFinish, loop]);
  const track = studyTracks.find(item => item.id === selected);
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[styles.button, disabled && styles.disabled]}><Text style={styles.text}>{label}</Text></Pressable>;
  const content = <ScrollView contentContainerStyle={styles.content}>
            {!embedded && <View style={[readerPanelHeader, { marginHorizontal: -20 }]}><Text accessibilityRole="header" style={readerPanelTitle}>BGM</Text></View>}
            <VerticalCarousel label="集中BGM" value={selected} onChange={id => void play(id)} items={studyTracks.filter(item => item.source !== null).map(item => ({ id: item.id, label: item.title }))} />
            <View style={styles.row}><SpeakerButton enabled={enabled} onToggle={() => { if (wanted.current) { pause(); } else { const id = selected ?? studyTracks.find(item => item.source !== null)?.id; if (id) void play(id); } }} /><View style={{ flex: 1 }}><VolumeBar value={volume} onChange={setVolume} /></View><Pressable accessibilityRole="switch" accessibilityLabel={loop ? '繰り返し再生・タップで一回再生' : '一回再生・タップで繰り返し再生'} accessibilityState={{ checked: loop }} onPress={() => setLoop(value => !value)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center' }}><AppIcon name={loop ? 'repeat' : 'looks_one'} /></Pressable></View>
            {!!(error || status.error) && <Text accessibilityRole="alert" style={styles.note}>{error || '音源を読み込めません。別の曲を選ぶか、音源を確認して再生し直してください。'}</Text>}
          </ScrollView>;
  // プレイヤーはシートの外に残す。閉じても再生を止めず、操作内容だけシートへ渡す。
  useEffect(() => { if (controlsOnly) onControls?.(content); }, [controlsOnly, onControls, status.playing, status.error, enabled, selected, volume, loop, error, embedded, setOpen]);
  if (controlsOnly) return null;
  if (embedded) return content;
  return <View>
    {!hideTrigger && <Pressable accessibilityRole="button" accessibilityLabel={`集中BGMを開く${status.playing ? '（再生中）' : ''}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={[readerToolButton, status.playing && styles.active]}>
      <AppIcon name="music_note" size={24} />
    </Pressable>}
    <ReaderPanel visible={open} label="集中BGM" onClose={() => setOpen(false)} desktop={<StudyToolPanel visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="集中BGMを閉じる" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.card}>
          {content}
        </View>
      </View>
    </StudyToolPanel>}>{content}</ReaderPanel>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 54, paddingHorizontal: 12, paddingBottom: 12 },
  card: { width: '100%', maxWidth: 360, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  content: { padding: 20, gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink }, text: { fontSize: 13, color: colors.ink }, note: { fontSize: 12, lineHeight: 18, color: colors.muted },
  button: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line }, disabled: { opacity: 0.4 },
  track: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  activeTrack: { borderColor: colors.accent, backgroundColor: colors.button }, active: { backgroundColor: colors.button },
  symbol: { fontSize: 24, color: colors.accent }, title: { fontSize: 15, fontWeight: '600', color: colors.ink }, trackBody: { flex: 1, gap: 4 },
});
