import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
const screens = [
  { title: '設定', rows: ['通知', 'サウンドと触覚', '☾ 集中モード'], chosen: 2 },
  { title: '集中モード　＋', rows: ['おやすみモード', 'カスタムを作成', '名前：読書'], chosen: 1 },
  { title: '通知を許可', rows: ['人を選ぶ', 'アプリを選ぶ', '必要な通知だけ許可'], chosen: 2 },
  { title: 'スケジュールを追加', rows: ['時刻', '場所', 'App → ドパBOOKs'], chosen: 2 },
];
export function FocusIllustration({ step }: { step: number }) {
  const screen = screens[step];
  return <View accessible accessibilityLabel={`設定画面のイメージ：${screen.title}。${screen.rows[screen.chosen]}を選択。`} style={s.stage}>
    <View style={s.phone}><View style={s.notch} /><Text style={s.title}>{screen.title}</Text>
      {screen.rows.map((row, i) => <View key={row} style={[s.row, i === screen.chosen && s.chosen]}><View style={[s.dot, i === screen.chosen && s.activeDot]} /><Text style={[s.text, i === screen.chosen && s.activeText]}>{row}</Text><Text style={s.arrow}>›</Text></View>)}
      <View style={s.home} />
    </View><Text style={s.caption}>画面イメージ</Text>
  </View>;
}
const s = StyleSheet.create({ stage: { backgroundColor: colors.paper, padding: 16, marginTop: 10, borderRadius: 16, alignItems: 'center', gap: 8 }, phone: { width: '100%', maxWidth: 250, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line, borderRadius: 24, padding: 12, paddingTop: 8, gap: 8 }, notch: { height: 4, width: 42, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 6 }, title: { color: colors.ink, fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 5 }, row: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.paper }, chosen: { backgroundColor: colors.accent }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line }, activeDot: { backgroundColor: colors.surface }, text: { flex: 1, color: colors.ink, fontSize: 10 }, activeText: { color: colors.surface, fontWeight: '600' }, arrow: { color: colors.wood, fontSize: 15 }, home: { height: 3, width: 55, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginTop: 9 }, caption: { color: colors.muted, fontSize: 9 } });
