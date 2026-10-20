import { artifactUrl } from '@/features/comic/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import { summaryLimit } from './model.mjs';
import { summaryFailure } from './summary-errors.mjs';

// onSummary：まとめが用意できたら知らせる（最新のしおりのまとめをウィジェットに出すため）
export function Summary({ text, cacheKey, onSummary }: { text: string; cacheKey: string; onSummary?: (summary: string) => void }) {
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(cacheKey).then(raw => {
      try { const value = raw ? JSON.parse(raw) : null; if (alive && value?.text === text && typeof value.summary === 'string' && value.summary.length <= 5000) { setSummary(value.summary); onSummary?.(value.summary); } }
      catch { /* 壊れた要約だけを無視し、本文としおりは保持する。 */ }
    }).catch(() => { if (alive) setError('保存したまとめを読み込めません。端末の保存設定を確認して再試行してください。'); })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; active.current?.abort(); active.current = null; };
  }, [cacheKey, text]);
  async function generate() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    const timer = setTimeout(() => controller.abort(), 55000);
    setBusy(true); setError('');
    try {
      const response = await fetch(artifactUrl('/api/summary'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: controller.signal });
      const value = await response.json();
      if (!response.ok) throw new Error(summaryFailure(value?.code).code);
      if (typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 5000) throw new Error('UNKNOWN');
      if (active.current !== controller) return;
      setSummary(value.summary);
      onSummary?.(value.summary);
      try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ text, summary: value.summary })); }
      catch { if (active.current === controller) setError('まとめは表示できますが保存できません。端末の空き容量や保存設定を確認してください。'); }
    } catch (reason) { if (active.current === controller) setError(summaryFailure(reason instanceof Error ? reason.name === 'AbortError' ? 'TIMEOUT' : reason.message : 'UNKNOWN').error); }
    finally { clearTimeout(timer); if (active.current === controller) { active.current = null; setBusy(false); } }
  }
  const tooLong = text.length > summaryLimit;
  return <View style={styles.box}>
    <Text style={styles.heading}>ここまでのまとめ</Text>
    {summary ? summary.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <Text key={index} style={styles.text}>{paragraph}</Text>) : <>
      {!text.trim() && <Text style={styles.note}>まだ本文がありません。読み進めた位置にしおりを挟んでください。</Text>}
      {tooLong && <Text style={styles.note}>範囲が長いため、「前回から」など短い範囲を選んでください。</Text>}
      <Pressable accessibilityRole="button" disabled={!ready || busy || tooLong || !text.trim()} onPress={generate} style={[styles.button, (!ready || busy || tooLong || !text.trim()) && styles.disabled]}><Text style={styles.buttonText}>{busy ? 'まとめています…' : error ? 'もう一度試す' : 'ここまでを振り返る'}</Text></Pressable>
    </>}
    {busy && <ActivityIndicator color={colors.accent} />}
    {!!error && <Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  box: { gap: 16 }, heading: { fontSize: 16, fontWeight: '700', color: colors.ink },
  text: { fontSize: 16, lineHeight: 29, color: colors.ink }, note: { fontSize: 14, lineHeight: 24, color: colors.muted },
  button: { backgroundColor: colors.accent, borderRadius: 999, padding: 14, alignItems: 'center' }, buttonText: { color: colors.surface, fontSize: 15 }, disabled: { opacity: 0.4 },
});
