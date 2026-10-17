import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MusicTrack } from '@/server/music.mjs';
import { colors } from '@/shared/theme';
import type { SavedBook } from '@/features/library/types';
import { MusicPlanEditor } from './MusicPlanEditor';

const moods = [{ id: 'calm', label: '穏やか' }, { id: 'tense', label: '緊張' }, { id: 'sad', label: '切ない' }, { id: 'bright', label: '明るい' }];
export function MusicPanel({ book }: { book: SavedBook }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState('calm');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [chosen, setChosen] = useState<MusicTrack | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    if (!chosen || status.isLoaded) return;
    const timer = setTimeout(() => setError('音源の読み込みに時間がかかっています。別の候補を選ぶか、曲名を押して再試行してください。'), 20000);
    return () => clearTimeout(timer);
  }, [chosen, status.isLoaded]);
  useFocusEffect(useCallback(() => () => { player.pause(); }, [player]));
  async function load() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/music?mood=${mood}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTracks(data.tracks);
      if (!data.tracks.length) setError('候補がありません。別の雰囲気でお試しください。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '音楽を取得できません。'); }
    finally { setBusy(false); }
  }
  async function play() {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      player.volume = 0.25; player.loop = true; player.play(); setError('');
    } catch { setError('再生できません。音源を選び直してください。'); }
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={[styles.button, disabled && { opacity: 0.4 }]}><Text style={styles.text}>{label}</Text></Pressable>;
  return <View style={styles.panel}>
    <View style={styles.row}>{button(open ? '音楽を閉じる' : '読書の音楽', () => setOpen(!open))}{button('本文から選曲・編集', () => { player.pause(); setEditing(true); })}{chosen && button(status.playing ? '一時停止' : status.isLoaded ? '再生' : '読込中…', () => status.playing ? player.pause() : void play(), !status.isLoaded)}</View>
    <MusicPlanEditor book={book} visible={editing} onClose={() => setEditing(false)} />
    {open && <ScrollView style={{ maxHeight: 240 }}>
      <Text style={styles.text}>雰囲気を選んで取得（最大3曲）。選んだ曲を再生します。</Text>
      <View style={styles.row}>{moods.map(item => <View key={item.id}>{button(`${mood === item.id ? '✓ ' : ''}${item.label}`, () => setMood(item.id))}</View>)}{button(busy ? '取得中…' : '音楽を取得', () => void load(), busy)}</View>
      {tracks.map(track => <View key={track.id} style={styles.row}>{button(`${chosen?.id === track.id ? '✓ ' : ''}${track.name}`, () => { player.pause(); player.replace({ uri: track.audioUrl }); setChosen(track); setError(''); })}</View>)}
      {chosen && <View><Text style={styles.text}>{chosen.name} / {chosen.creator}（Freesound）</Text><View style={styles.row}>{button('音源ページ', () => void Linking.openURL(chosen.url))}{button('利用許諾', () => void Linking.openURL(chosen.license))}</View></View>}
    </ScrollView>}
    {!!error && <Text accessibilityLiveRegion="polite" style={styles.text}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, padding: 8, borderBottomWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  button: { padding: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 8, marginVertical: 3 },
  text: { color: colors.ink, fontSize: 13 },
});
