import { AppIcon } from '@/shared/AppIcon';
import { ReviewText } from './ReviewText';
import { ReviewOverlays, type ReviewPerson } from './ReviewOverlays';
import { Avatar } from '@/shared/Avatar';
import { useAccount } from '@/features/account/AccountProvider';
import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';
import type { Review } from './model.mjs';
import { likeReview } from './publishing';
export function Stars({ value, onChange, disabled = false }: { value: number; onChange?: (value: number) => void; disabled?: boolean }) {
  return <View style={s.row} accessibilityLabel={`${value} / 5`}>{[1, 2, 3, 4, 5].map(star => onChange ? <Pressable key={star} accessibilityRole="button" accessibilityLabel={`${star}つ星`} accessibilityState={{ selected: star === value, disabled }} disabled={disabled} onPress={() => onChange(star)} style={{ paddingVertical: 8, paddingHorizontal: 3 }}><Text style={s.bigStar}>{star <= value ? '★' : '☆'}</Text></Pressable> : <Text key={star} style={s.star}>{star <= value ? '★' : '☆'}</Text>)}</View>;
}
export function Button({ children, onPress, subtle = false, disabled = false }: { children: string; onPress: () => void; subtle?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, subtle && s.subtleButton, disabled && { opacity: 0.4 }]}><Text style={subtle ? s.link : s.light}>{children}</Text></Pressable>;
}
export function RefreshButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="更新" disabled={loading} onPress={onPress} style={[s.refresh, loading && { opacity: 0.4 }]}><AppIcon name="refresh" size={18} /><Text style={s.link}>{loading ? '更新中…' : '更新'}</Text></Pressable>;
}
export function ReviewCard({ review, own = false, hideBook = false, expanded = false, beforeNavigate }: { expanded?: boolean; review: Review; own?: boolean; hideBook?: boolean; beforeNavigate?: () => void }) {
  const [reveal, setReveal] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [person, setPerson] = useState<ReviewPerson | null>(null);
  const { identity } = useAccount();
  const Card = expanded ? View : Pressable;
  return <Card style={s.card} onPress={expanded ? undefined : () => setPostOpen(true)} accessibilityRole={expanded || Platform.OS === 'web' ? undefined : "button"} role={!expanded && Platform.OS === 'web' ? "article" : undefined} {...(!expanded && Platform.OS === 'web' ? { onKeyDown: (event: { key?: string; target: unknown; currentTarget: unknown; preventDefault: () => void }) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setPostOpen(true); } } } : {})} accessibilityLabel={expanded ? undefined : `${review.displayName}の感想全文を読む`}>
    <View style={s.between}><Pressable accessibilityRole="button" accessibilityLabel={`${review.displayName}のプロフィール`} onPress={event => { event.stopPropagation(); setPerson({ did: review.did, name: review.displayName, handle: review.handle, avatar: review.avatar }); }} style={s.person}><Avatar uri={identity?.did === review.did ? identity.avatar : review.avatar} size={36} /><View style={s.grow}><Text style={s.name}>{review.displayName}</Text><Text style={s.meta} numberOfLines={1}>@{review.handle}</Text></View></Pressable><Text style={s.meta}>{new Date(review.updatedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</Text></View>
    {!hideBook && <Pressable accessibilityRole="link" onPress={event => { event.stopPropagation(); setBookOpen(true); }} style={s.bookLink}><View style={s.miniBook} /><View style={s.grow}><Text style={s.bookTitle}>{review.book.title}</Text><Text style={s.meta}>{review.book.author}</Text></View><Text style={s.link}>›</Text></Pressable>}
    <Stars value={review.rating} />
    {review.spoiler && !reveal ? <Pressable accessibilityRole="button" onPress={event => { event.stopPropagation(); setReveal(true); }} style={s.spoiler}><Text style={s.link}>ネタバレを含む感想を読む　＋</Text></Pressable> : !!review.text && <ReviewText text={review.text} expanded={expanded} />}
    <View style={s.between}>
      <LikeButton review={review} />
      {(own || (expanded && identity?.did === review.did)) && <Pressable accessibilityRole="button" onPress={event => { event.stopPropagation(); beforeNavigate?.(); router.push(`/compose-review?book=${review.book.id}` as Href); }}><Text style={s.link}>編集する</Text></Pressable>}
    </View>
    <ReviewOverlays post={postOpen ? review : null} bookId={bookOpen ? review.book.id : null} person={person} close={() => { setBookOpen(false); setPerson(null); setPostOpen(false); }} />
  </Card>;
}

// いいねボタン：押すとすぐ数を変えて（先に見た目を更新）、保存に失敗したら元に戻す
export function LikeButton({ review }: { review: Review }) {
  const { identity } = useAccount();
  const [liked, setLiked] = useState(!!identity && !!review.likedBy?.includes(identity.did));
  const [count, setCount] = useState(review.likes ?? 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function toggle() {
    if (!identity) { setMessage('いいねするには、Bluesky でサインインしてください。'); return; }
    const next = !liked;
    setBusy(true); setMessage(''); setLiked(next); setCount(c => c + (next ? 1 : -1));
    try { await likeReview(identity.did, review.uri, next); }
    catch (error) { setLiked(!next); setCount(c => c + (next ? -1 : 1)); setMessage(error instanceof Error ? error.message : 'いいねできませんでした。'); }
    finally { setBusy(false); }
  }
  return <View style={{ flexShrink: 1, gap: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={liked ? 'いいねを取り消す' : 'いいねする'} accessibilityState={{ selected: liked, disabled: busy }} disabled={busy} onPress={event => { event.stopPropagation(); void toggle(); }} style={s.like}>
      <Text style={[s.heart, liked && s.heartOn]}>{liked ? '♥' : '♡'}</Text>
      <Text style={[s.meta, liked && { color: colors.accent }]}>{count > 0 ? count : 'いいね'}</Text>
    </Pressable>
    {!!message && <Text style={s.error}>{message}</Text>}
  </View>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, body: { padding: 24, paddingBottom: 64, gap: 20, width: '100%', maxWidth: 780, alignSelf: 'center' },
  eyebrow: { color: colors.accent, fontSize: 10, letterSpacing: 1.8, fontWeight: '700' }, title: { color: colors.ink, fontSize: 30, fontWeight: '600', marginTop: 8 },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '600' }, note: { color: colors.muted, fontSize: 13, lineHeight: 22 }, meta: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, grow: { flex: 1, minWidth: 0 },
  refresh: { flexDirection: 'row', gap: 6, backgroundColor: colors.button, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  button: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center' }, subtleButton: { backgroundColor: colors.button },
  light: { color: colors.surface, fontSize: 14, fontWeight: '600' }, link: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 22, gap: 16 }, empty: { paddingVertical: 36, alignItems: 'center', gap: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }, avatar: { height: 36, width: 36, backgroundColor: colors.paper, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.accent, fontSize: 16 },
  name: { color: colors.ink, fontSize: 14, fontWeight: '600' }, bookLink: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.paper, padding: 14, borderRadius: 12 },
  miniBook: { width: 36, height: 48, backgroundColor: colors.accent, borderRadius: 3, borderLeftWidth: 4, borderLeftColor: '#294A37', alignItems: 'center', justifyContent: 'center' }, miniBookText: { color: colors.surface, fontSize: 13 },
  bookTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 24 }, reviewText: { color: colors.ink, fontSize: 15, lineHeight: 27 },
  star: { color: colors.rating, fontSize: 18 }, bigStar: { color: colors.rating, fontSize: 34 }, spoiler: { borderRadius: 12, backgroundColor: colors.paper, padding: 16 },
  input: { color: colors.ink, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, fontSize: 15, lineHeight: 26 },
  error: { color: '#8A3D35', fontSize: 13, lineHeight: 22 },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingRight: 8 },
  heart: { color: colors.muted, fontSize: 18 }, heartOn: { color: '#C2543F' }, selected: { borderColor: colors.accent, backgroundColor: '#EDF1EA' }, section: { gap: 10 },
});
