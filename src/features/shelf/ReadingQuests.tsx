import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccount } from '@/features/account/AccountProvider';
import { colors } from '@/shared/theme';
const items = [
  { id: 'add', title: '本を追加する', icon: '＋', steps: ['本棚の「本を追加」を開きます。', '青空文庫でタイトルや著者を検索します。', '好きな作品の「追加」を押すと完了です。'] },
  { id: 'bookmark', title: 'しおりを挟む', icon: '⚑', steps: ['小説を開いて「☰ メニュー」を押します。', '「しおりを挟む」から読んだ文字を選びます。', '「この位置に挟む」で保存すると完了です。'] },
  { id: 'guide', title: '読みガイドを使う', icon: '≋', steps: ['小説の「☰ メニュー」を開きます。', '読みガイドをONにして速さを選びます。', 'ガイドを開始すると完了です。'] },
] as const;
export function ReadingQuests() {
  const { prefs, ready } = useAccount(); const [folded, setFolded] = useState(false), [selected, setSelected] = useState<(typeof items)[number] | null>(null);
  if (!ready || !prefs.quests || items.every(item => prefs.done.includes(item.id))) return null;
  return <>
    <View style={s.panel}>
      <Pressable onPress={() => setFolded(!folded)} style={s.head}><View style={s.stack}>{[0, 1, 2].map(i => <View key={i} style={[s.book, { marginLeft: i % 2 ? 3 : 0, width: 23 - i }]} />)}</View><Text style={s.heading}>読書クエスト</Text><Text style={s.small}>{prefs.done.length}/3　{folded ? '＋' : '−'}</Text></Pressable>
      {!folded && items.map(item => <Pressable key={item.id} accessibilityLabel={`${item.title}の手順`} onPress={() => setSelected(item)} style={s.row}><Text style={s.icon}>{prefs.done.includes(item.id) ? '✓' : item.icon}</Text><Text style={[s.label, prefs.done.includes(item.id) && s.done]}>{item.title}</Text><Text style={s.small}>›</Text></Pressable>)}
    </View>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}><View style={s.overlay}><View style={s.guide}>
      <Text style={s.guideIcon}>{selected?.icon}</Text><Text style={s.title}>{selected?.title}</Text>
      {selected?.steps.map((step, i) => <View style={s.step} key={step}><Text style={s.number}>{i + 1}</Text><Text style={s.description}>{step}</Text></View>)}
      <Text style={s.small}>実際に操作すると、自動で完了になります。</Text>
      <Pressable onPress={() => setSelected(null)} style={s.close}><Text style={s.light}>閉じる</Text></Pressable>
    </View></View></Modal>
  </>;
}
const s = StyleSheet.create({ panel: { position: 'absolute', bottom: 18, right: 14, width: 260, backgroundColor: colors.surface, borderRadius: 10, borderLeftWidth: 5, borderLeftColor: colors.wood, padding: 12, boxShadow: '0 4px 16px rgba(41,46,41,0.16)', zIndex: 5 }, head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 }, heading: { color: colors.ink, fontSize: 14, flex: 1, fontWeight: '600' }, small: { color: colors.muted, fontSize: 11, lineHeight: 18 }, stack: { gap: 2 }, book: { height: 4, borderRadius: 1, backgroundColor: colors.accent }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 }, icon: { color: colors.accent, width: 20, fontSize: 16 }, label: { flex: 1, color: colors.ink, fontSize: 12 }, done: { color: colors.muted, textDecorationLine: 'line-through' }, overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(41,46,41,0.35)', padding: 24 }, guide: { backgroundColor: colors.surface, borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, gap: 18 }, guideIcon: { fontSize: 32, color: colors.accent }, title: { fontSize: 21, color: colors.ink }, step: { flexDirection: 'row', gap: 12 }, number: { color: colors.accent, fontSize: 16 }, description: { color: colors.ink, fontSize: 14, lineHeight: 23, flex: 1 }, close: { backgroundColor: colors.accent, borderRadius: 8, padding: 12, alignItems: 'center' }, light: { color: colors.surface } });
