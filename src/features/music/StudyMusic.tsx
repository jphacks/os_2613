import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors } from '@/shared/theme';
import { readerToolButton, readerToolSymbol } from '@/features/reader/toolStyles';
import { VolumeBar } from './VolumeBar';
import { studyTracks } from './study-tracks';

export function StudyMusic() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.3);
  const [error, setError] = useState('');
  const request = useRef(0);
  const stop = useCallback(() => { request.current++; player.pause(); setOpen(false); }, [player]);
  useFocusEffect(useCallback(() => stop, [stop]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => subscription.remove();
  }, [stop]);
  useEffect(() => { player.volume = volume; player.loop = true; }, [player, volume]);

  async function play(id: string) {
    const track = studyTracks.find(item => item.id === id);
    if (!track) return;
    const token = ++request.current;
    player.pause(); setSelected(id); setError('');
    if (track.source === null) {
      setError('この曲は準備中です。音源の追加後に、もう一度選んでください。');
      return;
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      if (token !== request.current) return;
      if (id !== selected || status.error) player.replace(track.source);
      player.loop = true; player.volume = volume; player.play();
    } catch {
      if (token === request.current) setError('再生できません。音源と端末の音声設定を確認して、再生し直してください。');
    }
  }
  const track = studyTracks.find(item => item.id === selected);
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[styles.button, disabled && styles.disabled]}><Text style={styles.text}>{label}</Text></Pressable>;
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`集中BGMを開く${status.playing ? '（再生中）' : ''}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={[readerToolButton, status.playing && styles.active]}>
      <Text style={readerToolSymbol}>♫</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="集中BGMを閉じる" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.card}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.row}><Text accessibilityRole="header" style={styles.heading}>集中BGM</Text>{button('閉じる', () => setOpen(false))}</View>
            <Text style={styles.note}>勉強のおともに、好きな音を。</Text>
            {studyTracks.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === selected }} onPress={() => void play(item.id)} style={[styles.track, item.id === selected && styles.activeTrack]}>
              <Text style={styles.symbol}>♪</Text><View style={styles.trackBody}><Text style={styles.title}>{item.title}</Text><Text style={styles.note}>{item.description}{item.source === null ? ' · 準備中' : ''}</Text></View>
            </Pressable>)}
            <View style={styles.row}><Text accessibilityLiveRegion="polite" style={styles.text}>{track ? `${track.title} · ${status.playing ? '再生中' : '停止中'}` : '曲を選んで再生'}</Text>{button(status.playing ? '一時停止' : '再生', () => { if (status.playing) { request.current++; player.pause(); } else if (selected) void play(selected); }, !track || track.source === null)}</View>
            <View style={styles.row}><Text style={styles.text}>音量</Text><Text style={styles.note}>{Math.round(volume * 100)}%</Text></View>
            <VolumeBar value={volume} onChange={setVolume} />
            <Text style={styles.note}>ループ再生 · 教材を離れると停止します · 再生には通信が必要です</Text>
            {!!(error || status.error) && <Text accessibilityRole="alert" style={styles.note}>{error || '音源を読み込めません。別の曲を選ぶか、音源を確認して再生し直してください。'}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: `${colors.ink}55` },
  card: { width: '100%', maxWidth: 360, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  content: { padding: 20, gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink }, text: { fontSize: 13, color: colors.ink }, note: { fontSize: 12, lineHeight: 18, color: colors.muted },
  button: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line }, disabled: { opacity: 0.4 },
  track: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  activeTrack: { borderColor: colors.accent, backgroundColor: colors.button }, active: { backgroundColor: colors.button },
  symbol: { fontSize: 24, color: colors.accent }, title: { fontSize: 15, fontWeight: '600', color: colors.ink }, trackBody: { flex: 1, gap: 4 },
});
