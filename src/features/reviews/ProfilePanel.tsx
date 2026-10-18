import { ReviewText } from './ReviewText';
import { ReviewOverlays, type ReviewPerson } from './ReviewOverlays';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccount } from '@/features/account/AccountProvider';
import { Avatar } from '@/shared/Avatar';
import { colors } from '@/shared/theme';
import type { Review } from './model.mjs';
import { Button, LikeButton, RefreshButton, s } from './ui';
import { useReviewFeed } from './useReviewFeed';

// タイムラインの「自分」の欄。Bluesky のプロフィール画面のように、背景の画像・アイコン・名前・ハンドル・
// フォロワー数・フォロー中の数・感想の数を出し、その下に自分の感想を並べる（プロフィールの編集は無し）。
// プロフィールと感想は1つの白い塊にまとめ、感想どうしは薄い線で区切る。

type Profile = { banner?: string; avatar?: string; displayName?: string; handle?: string; followersCount?: number; followsCount?: number };

// Bluesky の公開プロフィール（ログイン不要の公開の情報）
async function publicProfile(did: string): Promise<Profile | null> {
  try {
    const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

// 自分の感想の1行（Bluesky の投稿一覧のような並び）
function ReviewRow({ review, avatar, own }: { review: Review; avatar?: string; own: boolean }) {
  const [reveal, setReveal] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  return <Pressable style={p.row} accessibilityRole={Platform.OS === 'web' ? undefined : "button"} role={Platform.OS === 'web' ? "article" : undefined} {...(Platform.OS === 'web' ? { onKeyDown: (event: { key?: string; target: unknown; currentTarget: unknown; preventDefault: () => void }) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setPostOpen(true); } } } : {})} accessibilityLabel={`${review.displayName}の感想全文を読む`} onPress={() => setPostOpen(true)}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${review.displayName}のプロフィール`} onPress={event => { event.stopPropagation(); setPersonOpen(true); }}><Avatar uri={(own && avatar) || review.avatar} size={40} /></Pressable>
    <View style={p.rowBody}>
      <Text accessibilityRole="button" onPress={event => { event.stopPropagation(); setPersonOpen(true); }} style={p.rowHead} numberOfLines={1}><Text style={p.rowName}>{review.displayName}</Text>　@{review.handle}・{new Date(review.updatedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</Text>
      <Pressable accessibilityRole="link" onPress={event => { event.stopPropagation(); setBookOpen(true); }}>
        <Text style={p.rowTitle}>『{review.book.title}』　<Text style={p.rowStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text></Text>
      </Pressable>
      {review.spoiler && !reveal
        ? <Pressable accessibilityRole="button" onPress={event => { event.stopPropagation(); setReveal(true); }}><Text style={s.link}>ネタバレを含む感想を読む　＋</Text></Pressable>
        : !!review.text && <ReviewText text={review.text} compact />}
      <View style={p.rowFoot}>
        <LikeButton review={review} />
        {own && <Pressable accessibilityRole="button" onPress={event => { event.stopPropagation(); router.push(`/compose-review?book=${review.book.id}` as Href); }}><Text style={s.link}>編集する</Text></Pressable>}
      </View>
    </View>
    <ReviewOverlays post={postOpen ? review : null} bookId={bookOpen ? review.book.id : null} person={personOpen ? { did: review.did, name: review.displayName, handle: review.handle, avatar: review.avatar } : null} close={() => { setBookOpen(false); setPersonOpen(false); setPostOpen(false); }} />
  </Pressable>;
}

export function ProfilePanel({ actor }: { actor?: ReviewPerson } = {}) {
  const { identity } = useAccount();
  const person = actor || identity;
  const [profile, setProfile] = useState<Profile | null>(null);
  // タブ：「感想」は自分が書いた感想、「いいね」は自分がいいねした感想
  const [tab, setTab] = useState<'reviews' | 'likes'>('reviews');
  const { data, loading, error, refresh, more } = useReviewFeed(undefined, tab === 'reviews' ? person?.did : undefined, tab === 'likes' ? person?.did : undefined);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  useEffect(() => { if (tab === 'reviews' && data) setReviewCount(data.total); }, [tab, data]);
  useEffect(() => {
    let active = true;
    if (person) void publicProfile(person.did).then(value => { if (active) setProfile(value); });
    return () => { active = false; };
  }, [person?.did]);

  if (!person) return <View style={[s.card, { gap: 12 }]}>
    <Text style={s.heading}>あなたのページ</Text>
    <Text style={s.note}>Bluesky と接続すると、プロフィールと自分の感想がここに並びます。</Text>
    <Button subtle onPress={() => router.push('/compose-review' as Href)}>接続する ↗</Button>
  </View>;

  const name = profile?.displayName?.trim() || person.name;
  const avatar = profile?.avatar || person.avatar;
  return <ScrollView style={p.card}>
    <View style={p.refresh}><RefreshButton loading={loading} onPress={() => void refresh()} /></View>
    {/* 背景の画像（無ければ淡い色） */}
    {profile?.banner ? <Image source={{ uri: profile.banner }} style={p.banner} resizeMode="cover" accessibilityLabel="プロフィールの背景" /> : <View style={[p.banner, { backgroundColor: colors.line }]} />}
    <View style={p.body}>
      <View style={p.avatarRing}><Avatar uri={avatar} size={76} /></View>
      <Text style={p.name}>{name}</Text>
      <Text style={p.handle}>@{profile?.handle || person.handle}</Text>
      <View style={p.counts}>
        <Text style={p.count}><Text style={p.num}>{profile?.followersCount ?? '–'}</Text> フォロワー</Text>
        <Text style={p.count}><Text style={p.num}>{profile?.followsCount ?? '–'}</Text> フォロー中</Text>
        <Text style={p.count}><Text style={p.num}>{reviewCount ?? '–'}</Text> 感想</Text>
      </View>
    </View>
    <View style={p.tabs}>
      {([['reviews', '感想'], ['likes', 'いいね']] as const).map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={{ marginRight: 20 }}>
        <Text style={[p.tab, tab !== id && p.tabOff]}>{label}</Text>
      </Pressable>)}
    </View>
    {error ? <Text accessibilityRole="alert" style={[s.error, p.pad]}>{error}</Text> : null}
    {loading && !data && <Text style={[s.note, p.pad]}>{tab === 'likes' ? 'いいねした感想' : '自分の感想'}を読み込んでいます…</Text>}
    {data && data.reviews.length === 0 && (tab === 'likes'
      ? <View style={p.pad}><Text style={[s.note, { textAlign: 'center' }]}>まだいいねした感想がありません。タイムラインで ♡ を押すと、ここに並びます。</Text></View>
      : <View style={[p.pad, { gap: 12, alignItems: 'center' }]}><Text style={s.note}>まだ感想がありません。</Text><Button onPress={() => router.push('/compose-review' as Href)}>本を選んで書く</Button></View>)}
    {data?.reviews.map(review => <ReviewRow key={review.uri} review={review} avatar={avatar} own={review.did === identity?.did} />)}
    {data?.next != null && <Pressable accessibilityRole="button" disabled={loading} onPress={() => void more()} style={[p.pad, { alignItems: 'center' }]}><Text style={s.link}>{loading ? '読み込み中…' : 'もっと読む'}</Text></Pressable>}
  </ScrollView>;
}

const p = StyleSheet.create({
  refresh: { position: 'absolute', right: 12, top: 12, zIndex: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden' },
  banner: { width: '100%', height: 110 },
  body: { paddingHorizontal: 20, paddingBottom: 14, marginTop: -40, gap: 4 },
  avatarRing: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  name: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  handle: { color: colors.muted, fontSize: 14 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  count: { color: colors.muted, fontSize: 13 },
  num: { color: colors.ink, fontWeight: '700' },
  tabs: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: 20 },
  tab: { color: colors.ink, fontSize: 14, fontWeight: '700', paddingVertical: 12, borderBottomWidth: 3, borderColor: colors.accent },
  tabOff: { color: colors.muted, fontWeight: '600', borderColor: 'transparent' },
  pad: { padding: 20 },
  // 感想の1行：間を空けず、下に薄い線を引いて区切る
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowHead: { color: colors.muted, fontSize: 12 },
  rowName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  rowStars: { color: colors.rating, fontWeight: '400' },
  rowText: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
});
