import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { documentVersion, type Mark } from '@/features/bookmark/model.mjs';
import { colors } from '@/shared/theme';
import { artifactRequest } from '@/features/comic/api';
import { characterLimit, groundedGraph, textToBookmark, type Graph } from './model.mjs';

function Action({ children, press, selected = false, disabled = false }: { children: string; press: () => void; selected?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={press} style={[styles.button, selected && { backgroundColor: colors.accent }]}><Text style={{ color: selected ? colors.surface : colors.accent }}>{children}</Text></Pressable>;
}
export function Characters({ text, marks, jump }: { text: string; marks: Mark[]; jump: (offset: number) => void }) {
  const sorted = [...marks].sort((a, b) => b.updatedAt - a.updatedAt);
  const [selected, setSelected] = useState(sorted[0]?.id ?? '');
  const target = marks.find(mark => mark.id === selected);
  useEffect(() => { if (!target && sorted.length) setSelected(sorted[0].id); }, [target, marks]);
  const prefix = target ? textToBookmark(text, marks, target.id) : '';
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.title}>人物相関図</Text><Text style={styles.text}>本のはじめから、選んだしおりまでの人物と関係です。</Text>
    {!marks.length ? <Text style={styles.text}>読んだところにしおりを挟むと、そこまでの相関図を作れます。</Text> : <>
      <Text style={styles.heading}>対象のしおり</Text><View style={styles.row}>{sorted.map(mark => <Action key={mark.id} selected={selected === mark.id} press={() => setSelected(mark.id)}>{`しおり ${marks.findIndex(item => item.id === mark.id) + 1}${mark.id === sorted[0]?.id ? '（最後に操作）' : ''}`}</Action>)}</View>
      <GraphResult key={`${target?.id}:${target?.updatedAt}:${documentVersion(prefix)}`} text={prefix} jump={jump} />
    </>}
  </ScrollView>;
}
function GraphResult({ text, jump }: { text: string; jump: (offset: number) => void }) {
  const [graph, setGraph] = useState<Graph | null>(null), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState(''), [person, setPerson] = useState<string | null>(null);
  const active = useRef(true), controller = useRef<AbortController | null>(null);
  const key = `dopabooks:characters:v1:${documentVersion(text)}`;
  useEffect(() => {
    active.current = true;
    void AsyncStorage.getItem(key).then(raw => { if (!raw || !active.current) return; const cached = JSON.parse(raw); if (cached.text === text) setGraph(groundedGraph(cached.graph, text)); })
      .catch(() => { if (active.current) setError('保存した相関図を読み込めませんでした。もう一度作成してください。'); })
      .finally(() => { if (active.current) setReady(true); });
    return () => { active.current = false; controller.current?.abort(); };
  }, [key, text]);
  async function generate() {
    if (busy) return; setBusy(true); setError('');
    const request = new AbortController(); controller.current = request;
    const timer = setTimeout(() => request.abort(), 110000);
    try {
      const result = await artifactRequest('/api/characters', { text }, request.signal);
      const verified = groundedGraph(result.graph, text); if (!active.current) return;
      setGraph(verified);
      try { await AsyncStorage.setItem(key, JSON.stringify({ text, graph: verified })); }
      catch { if (active.current) setError('相関図は表示できますが、端末に保存できませんでした。保存設定を確認してください。'); }
    } catch (reason) { if (active.current) setError(reason instanceof Error && reason.name !== 'AbortError' ? reason.message : '作成に時間がかかっています。もう一度お試しください。'); }
    finally { clearTimeout(timer); if (active.current) setBusy(false); }
  }
  if (!text.trim()) return <Text style={styles.text}>しおりまでの本文がまだありません。読み進めてからしおりを挟んでください。</Text>;
  if (text.length > characterLimit) return <Text style={styles.text}>このしおりまでの本文が長いため、手前のしおりを選んでください（10万文字まで）。</Text>;
  const relations = graph?.relations.map((relation, index) => ({ ...relation, number: index + 1 })).filter(relation => !person || relation.from === person || relation.to === person) ?? [];
  return <View style={styles.result}>
    {!graph && <Action disabled={busy || !ready} press={() => void generate()}>{busy ? '人物と関係を調べています…' : error ? 'もう一度試す' : '相関図を作る'}</Action>}
    {busy && <ActivityIndicator color={colors.accent} />}
    {!!error && <Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
    {graph && <>
      {!graph.people.length ? <Text style={styles.text}>この範囲では、根拠を確認できる人物は見つかりませんでした。</Text> : <>
        <Diagram graph={graph} person={person} choose={setPerson} />
        <View style={styles.row}><Action selected={!person} press={() => setPerson(null)}>全員</Action>{graph.people.map((item, index) => <Action key={item.id} selected={person === item.id} press={() => setPerson(person === item.id ? null : item.id)}>{`${String.fromCharCode(65 + index)} ${item.name}`}</Action>)}</View>
        <Text style={styles.small}>英字は人物、線の番号は下の関係に対応します。人物を選ぶと、その人の関係を表示します。</Text>
        <Text style={styles.heading}>人物の根拠</Text>
        {graph.people.filter(item => !person || item.id === person).map(item => <View key={item.id} style={styles.card}><Text style={styles.heading}>{item.name}</Text><Text style={styles.quote}>{item.quote}</Text><Action press={() => jump(item.start)}>根拠の原文を読む →</Action></View>)}
        <Text style={styles.heading}>関係の根拠</Text>
        {!relations.length && <Text style={styles.text}>この範囲で引用から確認できる関係はありません。</Text>}
        {relations.map(item => <View key={item.number} style={styles.card}><Text style={styles.heading}>{item.number}. {graph.people.find(p => p.id === item.from)?.name} → {graph.people.find(p => p.id === item.to)?.name}：{item.label}</Text><Text style={styles.quote}>{item.quote}</Text><Action press={() => jump(item.start)}>根拠の原文を読む →</Action></View>)}
        <Text style={styles.small}>本文の引用を確認できた人物と関係だけを表示しています。</Text>
      </>}
    </>}
  </View>;
}
function Diagram({ graph, person, choose }: { graph: Graph; person: string | null; choose: (id: string | null) => void }) {
  const [width, setWidth] = useState(280); const height = 300, radius = Math.min(width / 2 - 25, 116);
  const nodes = graph.people.map((item, index) => ({ ...item, x: width / 2 + Math.cos(index * 2 * Math.PI / graph.people.length - Math.PI / 2) * radius, y: height / 2 + Math.sin(index * 2 * Math.PI / graph.people.length - Math.PI / 2) * radius }));
  return <View accessibilityLabel="人物と関係の図" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height, width: '100%', backgroundColor: colors.surface, borderRadius: 12 }}>
    {graph.relations.map((item, index) => {
      if (person && item.from !== person && item.to !== person) return null;
      const a = nodes.find(node => node.id === item.from)!, b = nodes.find(node => node.id === item.to)!;
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      return <View key={index} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ position: 'absolute', height: 2, width: length, left: x - length / 2, top: y - 1, backgroundColor: colors.accent, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }} />
        <Text style={{ position: 'absolute', left: x - 10, top: y - 12, width: 20, textAlign: 'center', backgroundColor: colors.surface, color: colors.accent }}>{index + 1}</Text>
      </View>;
    })}
    {nodes.map((node, index) => <Pressable key={node.id} accessibilityRole="button" accessibilityLabel={`${String.fromCharCode(65 + index)} ${node.name}`} accessibilityState={{ selected: person === node.id }} onPress={() => choose(person === node.id ? null : node.id)} style={{ position: 'absolute', left: node.x - 22, top: node.y - 22, width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.accent, backgroundColor: person === node.id ? colors.accent : colors.surface, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: person === node.id ? colors.surface : colors.accent, fontSize: 18 }}>{String.fromCharCode(65 + index)}</Text></Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  body: { padding: 20, gap: 18, paddingBottom: 40, maxWidth: 760, alignSelf: 'center', width: '100%' }, title: { color: colors.ink, fontSize: 26 }, text: { color: colors.ink, fontSize: 16, lineHeight: 28 }, heading: { fontSize: 17, color: colors.ink, fontWeight: '600' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, result: { gap: 18 }, button: { padding: 12, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignSelf: 'flex-start' }, card: { paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderColor: colors.line }, quote: { color: colors.ink, lineHeight: 27, borderLeftWidth: 3, borderColor: colors.accent, paddingLeft: 12 }, small: { color: colors.muted, fontSize: 13, lineHeight: 23 },
});
