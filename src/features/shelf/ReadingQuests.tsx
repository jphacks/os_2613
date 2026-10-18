import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAccount } from '@/features/account/AccountProvider';
import type { Quest } from '@/features/account/context';
import { colors } from '@/shared/theme';

// 読書クエスト：本の追加は読書の手順に含め、端末に合った目標だけを表示する。
// それぞれに説明・手順・イラストを付け、実際に操作すると自動で完了になる。
// ウィジェットだけはアプリから置いたか分からないので、「置けた」ボタンで完了にする。

type Item = { id: Quest; title: string; text: string; steps: string[]; go?: { label: string; to: Href }; manual?: boolean };

const items: Item[] = [
  { id: 'read', title: '本を読む', text: '読みたい本を本棚に追加して、縦書きで読み始めます。',
    steps: ['本棚の「＋ 本を追加」を押します。', 'タイトルや著者で検索し、読みたい作品の「追加」を押します。', '本棚に戻り、本を押して開きます。', 'スマホは左右にスワイプ、PCは紙面を押してページをめくります。', '本を開くと完了です。'], go: { label: '本を探して追加する', to: '/add' } },
  { id: 'bluesky', title: 'Bluesky と連携する', text: 'Bluesky のアカウントでログインすると、感想を共有できます。',
    steps: ['「設定」を開きます。', 'Bluesky のハンドル（例：name.bsky.social）を入力します。', 'ログインできたら完了です。'], go: { label: '設定を開く', to: '/settings' } },
  { id: 'review', title: '本のレビューを書く', text: '読んだ本に星と感想を付けて、みんなと共有します。',
    steps: ['本の紹介画面の「レビューを書く」を押します。', '星の数と感想を入力します。', '投稿すると完了です。'] },
  { id: 'focus', title: '通知をオフにする', text: '読んでいる間だけ、スマホの通知を止める設定をします。',
    steps: ['「読書集中モード」の案内を開きます。', '手順どおりに iPhone の集中モードを設定します。', '案内から設定アプリを開くと完了です。'], go: { label: '読書集中モードの案内', to: '/focus' } },
  { id: 'widget', title: 'ウィジェットを置く', text: 'ホーム画面に「しおり」ウィジェットを置くと、続きからすぐ読めます。',
    steps: ['ホーム画面の何もない所を長押しします。', '左上の「＋」→「ドパBOOKs」→「しおり」を選びます。', '小か中を選んで置けたら、下の「置けた」を押します。'], manual: true },
];

// クエストごとの小さなイラスト（線と面だけで描く）
function Illustration({ id, size = 44 }: { id: Quest; size?: number }) {
  const u = size / 44; // 44px を基準に拡大・縮小する
  const g = colors.accent, w = colors.surface, line = colors.line;
  switch (id) {
    case 'add': // 本の表紙と「＋」
      return <View style={{ width: size, height: size }}>
        <View style={{ position: 'absolute', left: 8 * u, top: 4 * u, width: 22 * u, height: 32 * u, borderRadius: 3 * u, backgroundColor: g }} />
        <View style={{ position: 'absolute', left: 8 * u, top: 4 * u, width: 4 * u, height: 32 * u, backgroundColor: 'rgba(0,0,0,0.2)' }} />
        <View style={{ position: 'absolute', right: 4 * u, bottom: 4 * u, width: 18 * u, height: 18 * u, borderRadius: 9 * u, backgroundColor: w, borderWidth: 2 * u, borderColor: g, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: g, fontSize: 13 * u, fontWeight: '700', lineHeight: 15 * u }}>＋</Text></View>
      </View>;
    case 'read': // 開いた本と文字の線
      return <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1].map(side => <View key={side} style={{ width: 18 * u, height: 26 * u, backgroundColor: w, borderWidth: 1.5 * u, borderColor: g, borderTopLeftRadius: side ? 0 : 4 * u, borderBottomLeftRadius: side ? 0 : 4 * u, borderTopRightRadius: side ? 4 * u : 0, borderBottomRightRadius: side ? 4 * u : 0, padding: 4 * u, gap: 3 * u }}>
          {[0, 1, 2].map(l => <View key={l} style={{ height: 1.5 * u, backgroundColor: line }} />)}
        </View>)}
      </View>;
    case 'bluesky': // 空に浮かぶ雲（連携）
      return <View style={{ width: size, height: size, borderRadius: 10 * u, backgroundColor: '#E6F0FB', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 28 * u, height: 14 * u, marginTop: 6 * u }}>
          <View style={{ position: 'absolute', left: 0, bottom: 0, width: 28 * u, height: 9 * u, borderRadius: 5 * u, backgroundColor: '#3F82D4' }} />
          <View style={{ position: 'absolute', left: 5 * u, bottom: 3 * u, width: 11 * u, height: 11 * u, borderRadius: 6 * u, backgroundColor: '#3F82D4' }} />
          <View style={{ position: 'absolute', left: 12 * u, bottom: 4 * u, width: 13 * u, height: 13 * u, borderRadius: 7 * u, backgroundColor: '#3F82D4' }} />
        </View>
      </View>;
    case 'review': // 星の評価と吹き出し
      return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* 星は吹き出しの内側に収まる大きさにする */}
        <View style={{ width: 40 * u, height: 24 * u, borderRadius: 7 * u, backgroundColor: w, borderWidth: 1.5 * u, borderColor: g, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><Text numberOfLines={1} style={{ color: g, fontSize: 6.5 * u, lineHeight: 9 * u, letterSpacing: 0 }}>★★★★☆</Text></View>
        <View style={{ width: 8 * u, height: 8 * u, backgroundColor: w, borderRightWidth: 1.5 * u, borderBottomWidth: 1.5 * u, borderColor: g, transform: [{ rotate: '45deg' }], marginTop: -5 * u, marginLeft: -16 * u }} />
      </View>;
    case 'focus': // 斜線の入ったベル（通知オフ）
      return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 22 * u, height: 22 * u, borderTopLeftRadius: 11 * u, borderTopRightRadius: 11 * u, borderBottomLeftRadius: 3 * u, borderBottomRightRadius: 3 * u, backgroundColor: g }} />
        <View style={{ width: 28 * u, height: 3 * u, borderRadius: 2 * u, backgroundColor: g }} />
        <View style={{ width: 7 * u, height: 4 * u, borderBottomLeftRadius: 4 * u, borderBottomRightRadius: 4 * u, backgroundColor: g, marginTop: 1 * u }} />
        <View style={{ position: 'absolute', width: 36 * u, height: 3 * u, borderRadius: 2 * u, backgroundColor: colors.surface, transform: [{ rotate: '-45deg' }] }} />
        <View style={{ position: 'absolute', width: 34 * u, height: 1.5 * u, backgroundColor: g, transform: [{ rotate: '-45deg' }] }} />
      </View>;
    default: // ホーム画面とウィジェット
      return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* スマホの枠の中に、上にウィジェット、下に3つずつ2段のアプリを並べる（枠からはみ出さない） */}
        <View style={{ width: 30 * u, height: 40 * u, borderRadius: 6 * u, borderWidth: 1.5 * u, borderColor: g, backgroundColor: w, paddingHorizontal: 4 * u, paddingVertical: 5 * u, gap: 3.5 * u }}>
          <View style={{ height: 11 * u, borderRadius: 2.5 * u, backgroundColor: g }} />
          {[0, 1].map(row => <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[0, 1, 2].map(i => <View key={i} style={{ width: 5.5 * u, height: 5.5 * u, borderRadius: 1.5 * u, backgroundColor: line }} />)}
          </View>)}
        </View>
      </View>;
  }
}

// 説明の画面に出す「手順のイメージ図」。実際の画面の形をまねて、押す所を緑で示す。
// 通知オフだけは、iPhone の実際の設定画面の画像を使う。
function Preview({ id }: { id: Quest }) {
  const g = colors.accent;
  const box = (children: React.ReactNode) => <View style={s.preview}>{children}<Text style={s.caption}>画面イメージ</Text></View>;
  switch (id) {
    case 'add':
      return box(<>
        <View style={p.bar}><Text style={p.muted}>走れメロス</Text><View style={p.btn}><Text style={p.btnText}>検索</Text></View></View>
        <View style={p.result}><View style={{ flex: 1 }}><Text style={p.bold}>走れメロス</Text><Text style={p.muted}>太宰 治</Text></View><View style={p.btn}><Text style={p.btnText}>追加</Text></View></View>
      </>);
    case 'read':
      // 縦書き：1列7文字ずつに分け、右の列から左へ並べる（紙面からはみ出さない文字数にする）
      return box(<>
        <View style={p.page}>
          {Array.from('メロスは激怒した。必ず、かの邪智暴虐の王を除かなければならぬ').reduce<string[]>((cols, ch, i) => { if (i % 7 === 0) cols.push(''); cols[cols.length - 1] += ch; return cols; }, [])
            .map((col, i) => <Text key={i} style={p.column}>{Array.from(col).join('\n')}</Text>)}
        </View>
        <Text style={p.swipeText}>← スワイプでめくる →</Text>
      </>);
    case 'bluesky':
      return box(<>
        <Text style={p.bold}>Bluesky でログイン</Text>
        <View style={p.input}><Text style={p.muted}>name.bsky.social</Text></View>
        <View style={[p.btn, { alignSelf: 'stretch', alignItems: 'center' }]}><Text style={p.btnText}>ログイン</Text></View>
      </>);
    case 'review':
      return box(<>
        <Text style={[p.stars, { color: g }]}>★★★★☆</Text>
        <View style={p.input}><Text style={p.muted}>友を信じて走る姿に胸が熱くなった。</Text></View>
        <View style={[p.btn, { alignSelf: 'flex-end' }]}><Text style={p.btnText}>投稿する</Text></View>
      </>);
    case 'focus':
      return box(<Image source={require('../../../assets/focus/step1-list.png')} style={p.shot} resizeMode="cover" accessibilityLabel="集中モードの一覧の画面" />);
    default:
      return box(<View style={p.widget}>
        <View style={p.spine} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[p.muted, { color: g, fontWeight: '700' }]}>▮ しおり</Text>
          <Text style={p.bold}>走れメロス</Text>
          <Text style={p.muted} numberOfLines={1}>友を人質に、三日で戻ると約束した。</Text>
          <View style={p.track}><View style={p.fill} /></View>
        </View>
      </View>);
  }
}

export function ReadingQuests() {
  const { prefs, ready, complete } = useAccount();
  const { width } = useWindowDimensions();
  const mobile = Platform.OS === 'ios' ? !Platform.isPad : width < 768;
  const visibleItems = items.filter(item => mobile || (item.id !== 'focus' && item.id !== 'widget'));
  const [foldedOverride, setFolded] = useState<boolean | null>(null);
  const folded = foldedOverride ?? mobile;
  const [selected, setSelected] = useState<Item | null>(null);
  if (!ready || !prefs.quests || visibleItems.every(item => prefs.done.includes(item.id))) return null;
  const doneCount = visibleItems.filter(item => prefs.done.includes(item.id)).length;
  return <>
    <View style={s.panel}>
      <Pressable onPress={() => setFolded(!folded)} style={s.head}>
        <View style={s.stack}>{[0, 1, 2].map(i => <View key={i} style={[s.book, { marginLeft: i % 2 ? 3 : 0, width: 23 - i }]} />)}</View>
        <Text style={s.heading}>読書クエスト</Text>
        <Text style={s.small}>{doneCount}/{visibleItems.length}　{folded ? '＋' : '−'}</Text>
      </Pressable>
      {/* 進み具合の棒 */}
      <View style={s.track}><View style={[s.fill, { width: `${(doneCount / visibleItems.length) * 100}%` }]} /></View>
      {!folded && visibleItems.map(item => {
        const done = prefs.done.includes(item.id);
        // 一覧はアイコンを付けず、箇条書きで並べる（イラストは説明の画面に出す）
        return <Pressable key={item.id} accessibilityLabel={`${item.title}の説明`} onPress={() => setSelected(item)} style={s.row}>
          <Text style={[s.bullet, done && s.bulletDone]}>{done ? '✓' : '・'}</Text>
          <Text style={[s.label, done && s.done]}>{item.title}</Text>
          <Text style={s.small}>›</Text>
        </Pressable>;
      })}
    </View>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={s.overlay}><View style={s.guideBox}><ScrollView style={s.scroll} contentContainerStyle={s.guide}>
        {selected && <>
          <View style={s.hero}><Illustration id={selected.id} size={72} /></View>
          <Text style={s.title}>{selected.title}</Text>
          <Text style={s.description}>{selected.text}</Text>
          {selected.id === 'read' && <><Text style={s.description}>{prefs.done.includes('add') ? '✓ 本の追加' : '1. 本を追加する'}</Text><Preview id="add" /><Text style={s.description}>{prefs.done.includes('read') ? '✓ 本を読む' : '2. 本を開いて読む'}</Text></>}
          <Preview id={selected.id} />
          {selected.steps.map((step, i) => <View style={s.step} key={step}><Text style={s.number}>{i + 1}</Text><Text style={s.description}>{step}</Text></View>)}
          {selected.go && <Pressable onPress={() => { const to = selected.go!.to; setSelected(null); router.push(to); }} style={s.primary}><Text style={s.light}>{selected.go.label}</Text></Pressable>}
          {selected.manual && !prefs.done.includes(selected.id) && <Pressable onPress={() => { complete(selected.id); setSelected(null); }} style={s.primary}><Text style={s.light}>置けた</Text></Pressable>}
          {!selected.manual && <Text style={s.small}>実際に操作すると、自動で完了になります。</Text>}
          <Pressable onPress={() => setSelected(null)} style={s.secondary}><Text style={s.closeText}>閉じる</Text></Pressable>
        </>}
      </ScrollView></View></View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  panel: { position: 'absolute', bottom: 18, right: 14, width: 280, backgroundColor: colors.surface, borderRadius: 12, borderLeftWidth: 5, borderLeftColor: colors.wood, padding: 12, boxShadow: '0 4px 16px rgba(41,46,41,0.16)', zIndex: 5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  heading: { color: colors.ink, fontSize: 14, flex: 1, fontWeight: '600' },
  small: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  stack: { gap: 2 }, book: { height: 4, borderRadius: 1, backgroundColor: colors.accent },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden', marginBottom: 4 },
  fill: { height: 4, backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7 },
  bullet: { width: 18, textAlign: 'center', color: colors.accent, fontSize: 13, fontWeight: '700' },
  bulletDone: { color: colors.muted },
  label: { flex: 1, color: colors.ink, fontSize: 12.5 },
  preview: { borderRadius: 12, backgroundColor: colors.paper, padding: 14, gap: 8 },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(41,46,41,0.35)', padding: 24 },
  guideBox: { width: '100%', maxWidth: 400, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  scroll: { flexGrow: 0 },
  guide: { padding: 24, gap: 14 },
  hero: { alignSelf: 'center', width: 104, height: 104, borderRadius: 24, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, color: colors.ink, textAlign: 'center' },
  step: { flexDirection: 'row', gap: 12 },
  number: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  description: { color: colors.ink, fontSize: 14, lineHeight: 23, flex: 1 },
  primary: { backgroundColor: colors.accent, borderRadius: 10, padding: 12, alignItems: 'center' },
  secondary: { borderRadius: 10, padding: 10, alignItems: 'center' },
  light: { color: colors.surface, fontWeight: '600' },
  closeText: { color: colors.accent },
  caption: { color: colors.muted, fontSize: 9, textAlign: 'center' },
});

// 手順のイメージ図の部品
const p = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 8 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: colors.line, paddingTop: 8 },
  btn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  btnText: { color: colors.surface, fontSize: 11, fontWeight: '700' },
  bold: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  muted: { flex: 1, color: colors.muted, fontSize: 11 },
  page: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row-reverse', gap: 8, overflow: 'hidden' },
  column: { color: colors.ink, fontSize: 13, lineHeight: 16, textAlign: 'center', width: 16 },
  swipeText: { color: colors.accent, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  input: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 9 },
  stars: { fontSize: 22, textAlign: 'center', letterSpacing: 2 },
  shot: { width: '100%', height: 150, borderRadius: 10 },
  widget: { flexDirection: 'row', height: 86, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 4, borderLeftWidth: 0, borderColor: colors.accent, gap: 10, paddingRight: 10, alignItems: 'center' },
  spine: { width: 12, alignSelf: 'stretch', backgroundColor: colors.accent },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { width: '35%', height: 4, backgroundColor: colors.accent },
});
