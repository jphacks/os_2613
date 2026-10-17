import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { dailyMinutes, loadStats, monthlyMinutes, summarize, type Stats } from '@/features/stats/stats';
import { listWidgetBooks, type WidgetBook } from '@/features/widget/bookmarks';
import { colors } from '@/shared/theme';

// 分析画面「読書の記録」。Web とスマホで同じ画面を使い、幅に合わせて並べ方を変える。
// 今月の数字（読書時間・読み終わった本・追加した本・しおり）と、
// 直近7日・直近6か月の読書時間の棒グラフ、しおりを挟んでいる本の進み具合を出す。

export default function StatsScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const [stats, setStats] = useState<Stats | null>(null);
  const [marked, setMarked] = useState<WidgetBook[]>([]);

  // 画面を開くたびに最新の記録を読み直す
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([loadStats(), listWidgetBooks()]).then(([s, m]) => { if (active) { setStats(s); setMarked(m); } });
    return () => { active = false; };
  }, []));

  if (!stats) return <View style={styles.screen}><Text style={styles.note}>記録を読み込んでいます…</Text></View>;

  const sum = summarize(stats);
  const tiles = [
    { label: '読書時間', value: sum.minutes.month, unit: '分', total: `合計 ${sum.minutes.total.toLocaleString()}分` },
    { label: '読み終わった本', value: sum.finished.month, unit: '冊', total: `合計 ${sum.finished.total}冊` },
    { label: '追加した本', value: sum.added.month, unit: '冊', total: `合計 ${sum.added.total}冊` },
    { label: 'しおりを挟んだ本', value: marked.length, unit: '冊', total: '読みかけの本' },
  ];
  const [year, month] = sum.month.split('-');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text style={styles.eyebrow}>READING LOG</Text>
      <Text style={styles.title}>読書の記録</Text>
      <Text style={styles.note}>{year}年{Number(month)}月</Text>

      {/* 今月の数字。広い画面は4つ横並び、スマホは2つずつ */}
      <View style={styles.tiles}>
        {tiles.map(t => (
          <View key={t.label} style={[styles.tile, { width: wide ? '23.5%' : '48%' }]}>
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={styles.tileValue}>{t.value.toLocaleString()}<Text style={styles.tileUnit}> {t.unit}</Text></Text>
            <Text style={styles.note}>{t.total}</Text>
          </View>
        ))}
      </View>

      <View style={wide ? styles.row : undefined}>
        <Chart title="この7日間" unit="分" data={dailyMinutes(stats)} />
        <Chart title="月ごとの読書時間" unit="直近6か月・分" data={monthlyMinutes(stats)} />
      </View>

      {/* しおりを挟んでいる本の進み具合。押すとその本を開く */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>読みかけの本</Text>
        {!marked.length && <Text style={styles.note}>本にしおりを挟むと、ここに進み具合が出ます。</Text>}
        {marked.map(book => (
          <Pressable key={book.bookId} onPress={() => router.push(`/book/${book.bookId}`)} style={styles.bookRow}>
            <View style={styles.ribbon} />
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={1}>{book.title}<Text style={styles.note}>　{book.author}</Text></Text>
              <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, book.progress)}%` }]} /></View>
            </View>
            <Text style={styles.percent}>{book.progress}%</Text>
          </Pressable>
        ))}
      </View>

      {sum.minutes.total === 0 && <Text style={[styles.note, styles.center]}>本を開くと、読んだ時間がここに積み上がります。</Text>}
    </ScrollView>
  );
}

// 棒グラフ。一番多い日（月）を基準に高さを決める。
function Chart({ title, unit, data }: { title: string; unit: string; data: { key: string; label: string; minutes: number }[] }) {
  const peak = Math.max(1, ...data.map(d => d.minutes));
  return (
    <View style={[styles.card, styles.flex]}>
      <Text style={styles.cardTitle}>{title}<Text style={styles.note}>　{unit}</Text></Text>
      <View style={styles.chart}>
        {data.map(d => (
          <View key={d.key} style={styles.col}>
            <Text style={styles.colValue}>{d.minutes || ''}</Text>
            <View style={[styles.bar, { height: `${Math.max(3, (d.minutes / peak) * 100)}%`, opacity: d.minutes ? 1 : 0.25 }]} />
            <Text style={styles.note}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: 20, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, color: colors.accent, fontWeight: '700' },
  title: { fontSize: 28, color: colors.ink, marginTop: -8 },
  note: { fontSize: 12, color: colors.muted, lineHeight: 20 },
  center: { textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 4 },
  tileLabel: { fontSize: 12, color: colors.muted },
  tileValue: { fontSize: 30, color: colors.ink, fontWeight: '600' },
  tileUnit: { fontSize: 13, color: colors.muted, fontWeight: '400' },
  row: { flexDirection: 'row', gap: 16 },
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 12, marginBottom: 0 },
  cardTitle: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  chart: { flexDirection: 'row', height: 150, alignItems: 'flex-end', gap: 8 },
  col: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  colValue: { fontSize: 10, color: colors.muted },
  bar: { width: '70%', maxWidth: 36, backgroundColor: colors.accent, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  ribbon: { width: 8, height: 26, backgroundColor: colors.accent, borderBottomLeftRadius: 1, borderBottomRightRadius: 1 },
  bookInfo: { flex: 1, gap: 6 },
  bookTitle: { fontSize: 14, color: colors.ink },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 5, backgroundColor: colors.accent },
  percent: { fontSize: 12, color: colors.muted, minWidth: 36, textAlign: 'right' },
});
