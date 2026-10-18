import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { documentVersion, type Mark } from '@/features/bookmark/model.mjs';
import { colors, coverColors } from '@/shared/theme';
import { artifactRequest } from '@/features/comic/api';
import { characterLayout } from './layout.mjs';
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
    <Text style={styles.text}>本のはじめから、選んだしおりまでの人物と関係です。</Text>
    {!marks.length ? <Text style={styles.text}>読んだところにしおりを挟むと、そこまでの相関図を作れます。</Text> : <>
      <Text style={styles.heading}>対象のしおり</Text><View style={styles.row}>{sorted.map(mark => <Action key={mark.id} selected={selected === mark.id} press={() => setSelected(mark.id)}>{`しおり ${marks.findIndex(item => item.id === mark.id) + 1}${mark.id === sorted[0]?.id ? '（最後に操作）' : ''}`}</Action>)}</View>
      <GraphResult key={`${target?.id}:${target?.updatedAt}:${documentVersion(prefix)}`} text={prefix} jump={jump} />
    </>}
  </ScrollView>;
}
function GraphResult({ text, jump }: { text: string; jump: (offset: number) => void }) {
  const [graph, setGraph] = useState<Graph | null>(null), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState(''), [person, setPerson] = useState<string | null>(null), [evidence, setEvidence] = useState(false);
  const active = useRef(true), controller = useRef<AbortController | null>(null);
  const key = `dopabooks:characters:v2:${documentVersion(text)}`;
  useEffect(() => {
    active.current = true;
    void AsyncStorage.getItem(key).then(raw => { if (!raw || !active.current) return; const cached = JSON.parse(raw); if (cached.text === text) setGraph(groundedGraph(cached.graph, text)); })
      .catch(() => { if (active.current) setError('保存した相関図を読み込めませんでした。もう一度作成してください。'); })
      .finally(() => { if (active.current) setReady(true); });
    return () => { active.current = false; controller.current?.abort(); };
  }, [key, text]);
  async function generate(refresh = false) {
    if (busy) return; setBusy(true); setError('');
    const request = new AbortController(); controller.current = request;
    const timer = setTimeout(() => request.abort(), 200000);
    try {
      const result = await artifactRequest('/api/characters', { text, ...(refresh ? { refresh: true } : {}) }, request.signal);
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
      {!graph.relations.length && <Action disabled={busy} press={() => void generate(true)}>{busy ? '関係を調べています…' : '関係をもう一度調べる'}</Action>}
      {!graph.people.length ? <Text style={styles.text}>この範囲では、根拠を確認できる人物は見つかりませんでした。</Text> : <>
        <Diagram graph={graph} person={person} choose={setPerson} />
        {person && <Action press={() => setPerson(null)}>全員の関係を表示</Action>}
        <Text style={styles.small}>人物を押すと、その人のつながりを強調します。本文で確認できた関係だけを表示しています。</Text>
        <Action selected={evidence} press={() => setEvidence(value => !value)}>{evidence ? '原文の根拠を閉じる' : '原文の根拠を見る'}</Action>
        {evidence && <>
        <Text style={styles.heading}>人物の根拠</Text>
        {graph.people.filter(item => !person || item.id === person).map(item => <View key={item.id} style={styles.card}><Text style={styles.heading}>{item.name}</Text><Text style={styles.quote}>{item.quote}</Text><Action press={() => jump(item.start)}>根拠の原文を読む →</Action></View>)}
        <Text style={styles.heading}>関係の根拠</Text>
        {!relations.length && <Text style={styles.text}>この範囲で引用から確認できる関係はありません。</Text>}
        {relations.map(item => <View key={item.number} style={styles.card}><Text style={styles.heading}>{item.number}. {graph.people.find(p => p.id === item.from)?.name} → {graph.people.find(p => p.id === item.to)?.name}：{item.label}</Text><Text style={styles.quote}>{item.quote}</Text><Action press={() => jump(item.start)}>根拠の原文を読む →</Action></View>)}
        </>}
      </>}
    </>}
  </View>;
}
function Avatar({ index }: { index: number }) {
  const color = coverColors[index % coverColors.length];
  return <View accessible={false} style={[styles.avatar, { backgroundColor: color + '18' }]}>
    <View style={[styles.avatarHead, { backgroundColor: color }]} />
    <View style={[styles.avatarShoulders, { backgroundColor: color }]} />
  </View>;
}
function Diagram({ graph, person, choose }: { graph: Graph; person: string | null; choose: (id: string | null) => void }) {
  const layout = characterLayout(graph);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [overview, setOverview] = useState(Platform.OS !== 'web');
  const [viewportWidth, setViewportWidth] = useState(0);
  const scale = overview ? Math.min(1, viewportWidth / layout.width) : 1;
  useEffect(() => {
    if (viewportWidth > 0) scroller.current?.scrollTo({ x: overview ? 0 : Math.max(0, (layout.width - viewportWidth) / 2), animated: false });
  }, [overview, viewportWidth, layout.width]);
  const related = new Set(graph.relations.filter(item => item.from === person || item.to === person).flatMap(item => [item.from, item.to]));
  return <View style={styles.diagram}>
    {Platform.OS !== 'web' && <View style={styles.row}><Action selected={overview} press={() => setOverview(true)}>全体表示</Action><Action selected={!overview} press={() => setOverview(false)}>拡大表示</Action></View>}
    <Text style={styles.small}>{overview ? '図全体を表示しています。拡大表示にすると、人物名や関係を詳しく確認できます。' : '左右に動かして図を見られます。人物を押すと、その人のつながりが強調されます。'}</Text>
    <ScrollView ref={scroller} horizontal nestedScrollEnabled scrollEnabled={!overview} showsHorizontalScrollIndicator={!overview} style={styles.graphScroll} onLayout={event => setViewportWidth(Math.max(0, event.nativeEvent.layout.width - 2))}>
      <View style={{ width: layout.width * scale, height: layout.height * scale, overflow: 'hidden' }}>
      <View accessibilityLabel="人物と関係の図" style={{ width: layout.width, height: layout.height, ...(overview ? { position: 'absolute', left: (layout.width * scale - layout.width) / 2, top: (layout.height * scale - layout.height) / 2, transform: [{ scale }] } : {}) }}>
        {layout.edges.map((edge, index) => {
          const highlighted = !person || edge.from === person || edge.to === person;
          const middleX = edge.x + Math.cos(edge.angle) * edge.length / 2, middleY = edge.y + Math.sin(edge.angle) * edge.length / 2;
          return <View key={index} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: highlighted ? 1 : 0.12 }]}>
            <View style={{ position: 'absolute', width: edge.length, height: 16, left: middleX - edge.length / 2, top: middleY - 8, transform: [{ rotate: edge.angle + 'rad' }] }}>
              <View style={{ position: 'absolute', height: 2, width: edge.length, left: 0, top: 7, backgroundColor: colors.accent }} />
              {[-1, 1].map(side => <View key={side} style={{ position: 'absolute', width: 10, height: 2, left: edge.length - Math.sqrt(3) * 2.5 - 5, top: 7 + side * 2.5, backgroundColor: colors.accent, transform: [{ rotate: -side * Math.PI / 6 + 'rad' }] }} />)}
            </View>
          </View>;
        })}
        {layout.edges.map((edge, index) => <View key={index} pointerEvents="none" style={[styles.edgeLabel, { width: edge.labelWidth, height: edge.labelHeight, left: edge.labelX - edge.labelWidth / 2, top: edge.labelY - edge.labelHeight / 2, transform: [{ rotate: edge.labelAngle + 'rad' }], opacity: !person || edge.from === person || edge.to === person ? 1 : 0.15 }]}><Text accessibilityLabel={edge.label} numberOfLines={edge.labelVertical ? undefined : 1} ellipsizeMode="tail" style={[styles.relationLabel, edge.labelVertical && styles.verticalRelationLabel]}>{edge.labelText}</Text></View>)}
        {layout.nodes.map((node, index) => <Pressable key={node.id} accessibilityRole="button" accessibilityLabel={node.name} accessibilityState={{ selected: person === node.id }}
          onPress={() => choose(person === node.id ? null : node.id)} style={[styles.graphPerson, { left: node.x - 50, top: node.y - 54, opacity: person && node.id !== person && !related.has(node.id) ? 0.4 : 1 }, person === node.id && styles.personSelected]}>
          <Avatar index={index} /><Text style={styles.personName}>{node.name}</Text>
        </Pressable>)}
      </View>
      </View>
    </ScrollView>
    {!graph.relations.length && <Text style={styles.small}>人物は確認できましたが、関係の根拠はまだ確認できていません。表示していない関係を推測で補うことはありません。</Text>}
  </View>;
}
const styles = StyleSheet.create({
  diagram: { gap: 12 }, graphScroll: { maxWidth: '100%', flexGrow: 0, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, graphPerson: { position: 'absolute', width: 100, minHeight: 108, padding: 8, alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, edgeLabel: { position: 'absolute', height: 24, paddingHorizontal: 4, borderRadius: 4, backgroundColor: colors.surface, justifyContent: 'center' },
  personSelected: { backgroundColor: '#EAF0E8', borderColor: colors.accent }, personName: { color: colors.ink, fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '600' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', overflow: 'hidden' }, avatarHead: { position: 'absolute', width: 16, height: 16, borderRadius: 8, top: 9 }, avatarShoulders: { position: 'absolute', width: 32, height: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16, top: 29 },
  relationLabel: { color: colors.accent, fontSize: 13, lineHeight: 20, textAlign: 'center', fontWeight: '600' },
  verticalRelationLabel: { lineHeight: 18 },
  body: { padding: 20, gap: 18, paddingBottom: 40, maxWidth: 760, alignSelf: 'center', width: '100%' }, title: { color: colors.ink, fontSize: 26 }, text: { color: colors.ink, fontSize: 16, lineHeight: 28 }, heading: { fontSize: 17, color: colors.ink, fontWeight: '600' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, result: { gap: 18 }, button: { padding: 12, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignSelf: 'flex-start' }, card: { paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderColor: colors.line }, quote: { color: colors.ink, lineHeight: 27, borderLeftWidth: 3, borderColor: colors.accent, paddingLeft: 12 }, small: { color: colors.muted, fontSize: 13, lineHeight: 23 },
});
