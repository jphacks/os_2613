import { takeReviewNotice, type ReviewNotice } from '@/features/reviews/notice';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/features/account/AccountProvider';
import { ReviewCard, Button, RefreshButton, s } from '@/features/reviews/ui';
import { useReviewFeed } from '@/features/reviews/useReviewFeed';
import { ProfilePanel } from '@/features/reviews/ProfilePanel';

// タイムライン。
// ・PC など広い画面：左（6）に「おすすめ／フォロー中」の感想、右（4）に自分のプロフィールと感想を並べる
// ・スマホなど狭い画面：1列にして、「おすすめ／フォロー中／自分」を切り替える

// Bluesky で自分がフォローしている人の一覧（公開の情報。最大500人）
async function followingDids(did: string): Promise<Set<string>> {
  const dids = new Set<string>();
  let cursor = '';
  for (let page = 0; page < 5; page++) {
    const query = new URLSearchParams({ actor: did, limit: '100', ...(cursor ? { cursor } : {}) });
    const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?${query}`);
    if (!response.ok) break;
    const data = await response.json();
    for (const follow of data.follows ?? []) if (typeof follow.did === 'string') dids.add(follow.did);
    if (!data.cursor) break;
    cursor = data.cursor;
  }
  return dids;
}

type Tab = 'recommend' | 'following' | 'mine';

// 切り替え：グレーの大きな背景の上で、選んでいる方が白く浮く
function Segmented({ items, value, onChange }: { items: { id: Tab; label: string }[]; value: Tab; onChange: (id: Tab) => void }) {
  return <View style={seg.track}>
    {items.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: value === item.id }} onPress={() => onChange(item.id)} style={[seg.item, value === item.id && seg.active]}>
      <Text style={[seg.label, value === item.id && seg.activeLabel]}>{item.label}</Text>
    </Pressable>)}
  </View>;
}
const wideStyles = StyleSheet.create({
  wrap: { flex: 1, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12, gap: 20 },
  columns: { flex: 1, flexDirection: 'row' },
  column: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 64 },
  divider: { width: 1, backgroundColor: '#DED9CB', marginVertical: 8 },
});
const seg = StyleSheet.create({
  // 角は半円（端が丸くなるよう、十分大きな角丸にする）
  track: { flexDirection: 'row', backgroundColor: '#E6E3DA', borderRadius: 999, padding: 4, flex: 1, maxWidth: 520 },
  item: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999 },
  active: { backgroundColor: '#FFFDF8', boxShadow: '0 1px 4px rgba(41,46,41,0.15)' },
  label: { color: '#6E7468', fontSize: 14, fontWeight: '600' },
  activeLabel: { color: '#292E29' },
});

export default function TimelineScreen() {
  const { identity } = useAccount();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [toast, setToast] = useState<ReviewNotice | null>(null);
  useFocusEffect(useCallback(() => { const message = takeReviewNotice(); if (message) setToast(message); }, []));
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timer); }, [toast]);
  const [tab, setTab] = useState<Tab>('recommend');
  // 広い画面では「自分」は右の欄に常に出すので、左は「おすすめ／フォロー中」だけにする
  const current: Tab = wide && tab === 'mine' ? 'recommend' : tab;
  const { data, loading, error, refresh, more } = useReviewFeed();
  const [follows, setFollows] = useState<Set<string> | null>(null);
  useEffect(() => {
    let active = true;
    setFollows(null);
    if (identity && current === 'following') void followingDids(identity.did).then(value => { if (active) setFollows(value); }).catch(() => { if (active) setFollows(new Set()); });
    return () => { active = false; };
  }, [identity, current]);
  // フォロー中：読み込んだ感想のうち、フォローしている人のものだけを出す
  const reviews = useMemo(() => {
    if (!data) return [];
    if (current !== 'following') return data.reviews;
    return follows ? data.reviews.filter(review => follows.has(review.did)) : [];
  }, [data, current, follows]);

  const feed = <View style={{ gap: 20 }}>
    <View style={s.between}>
      <Segmented value={current} onChange={setTab} items={[
        { id: 'recommend', label: 'おすすめ' },
        ...(identity ? [{ id: 'following' as Tab, label: 'フォロー中' }] : []),
        ...(!wide && identity ? [{ id: 'mine' as Tab, label: '自分' }] : []),
      ]} />
      {current !== 'mine' && <RefreshButton loading={loading} onPress={() => void refresh()} />}
    </View>
    {current === 'mine' ? <ProfilePanel /> : <>
      {!identity && <View style={s.bookLink}><View style={s.grow}><Text style={s.bookTitle}>あなたの感想も、ここに。</Text><Text style={s.note}>レビューを書くにはBlueskyと接続します。</Text></View><Button subtle onPress={() => router.push('/compose-review' as Href)}>接続する ↗</Button></View>}
      {error ? <View style={s.section}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button subtle onPress={() => void refresh()}>再試行</Button></View> : null}
      {(loading && !data) || (current === 'following' && !follows) ? <Text style={s.note}>感想を読み込んでいます…</Text> : null}
      {data && reviews.length === 0 && (current !== 'following' || follows) && <View style={[s.card, s.empty]}>
        <Text style={s.heading}>{current === 'following' ? 'フォロー中の人の感想はまだありません' : '最初の感想を書いてみませんか'}</Text>
        <Text style={s.note}>{current === 'following' ? 'Bluesky でフォローしている人が感想を書くと、ここに並びます。' : '読み終えた気持ちも、途中で出会った一文も。'}</Text>
        {current !== 'following' && <Button onPress={() => router.push('/compose-review' as Href)}>本を選んで書く</Button>}</View>}
      {reviews.map(review => <ReviewCard key={review.uri} review={review} own={identity?.did === review.did} />)}
      {data?.next != null && <Button subtle disabled={loading} onPress={() => void more()}>{loading ? '読み込み中…' : 'もっと読む'}</Button>}
    </>}
  </View>;

  const header = <>
    <View style={s.between}><View><Text style={s.title}>タイムライン</Text></View><Button onPress={() => router.push('/compose-review' as Href)}>＋ 感想を書く</Button></View>
    {!!toast && <View style={{ backgroundColor: '#E8EEE5', borderRadius: 12, padding: 12, gap: 6 }}><Text accessibilityRole="status" accessibilityLiveRegion="polite" style={s.link}>{toast.message}</Text>{toast.blueskyUrl && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(toast.blueskyUrl!)}><Text style={s.link}>Blueskyで確認 ↗</Text></Pressable>}</View>}
  </>;

  // 広い画面：左右を切り離し、間に薄い縦線を引いて、それぞれ別々にスクロールできるようにする
  if (wide) return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={wideStyles.wrap}>
      <View style={wideStyles.header}>{header}</View>
      <View style={wideStyles.columns}>
        <ScrollView style={{ flex: 6 }} contentContainerStyle={wideStyles.column}>{feed}</ScrollView>
        <View style={wideStyles.divider} />
        <ScrollView style={{ flex: 4 }} contentContainerStyle={wideStyles.column}><ProfilePanel /></ScrollView>
      </View>
    </View>
  </SafeAreaView>;

  return <SafeAreaView edges={['top']} style={s.screen}>
    <ScrollView contentContainerStyle={s.body}>{header}{feed}</ScrollView>
  </SafeAreaView>;
}
