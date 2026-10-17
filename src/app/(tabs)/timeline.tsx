import { takeReviewNotice, type ReviewNotice } from '@/features/reviews/notice';
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '@/features/account/AccountProvider';
import { ReviewCard, Button, s } from '@/features/reviews/ui';
import { useReviewFeed } from '@/features/reviews/useReviewFeed';
export default function TimelineScreen() {
  const { identity } = useAccount();
  const [toast, setToast] = useState<ReviewNotice | null>(null);
  useFocusEffect(useCallback(() => { const message = takeReviewNotice(); if (message) setToast(message); }, []));
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timer); }, [toast]);
  const [mine, setMine] = useState(false);
  const { data, loading, error, refresh, more } = useReviewFeed(undefined, mine ? identity?.did : undefined);
  return <SafeAreaView edges={['top']} style={s.screen}><ScrollView contentContainerStyle={s.body}>
    <View style={s.between}><View><Text style={s.title}>タイムライン</Text></View><Button onPress={() => router.push('/compose-review' as Href)}>＋ 感想を書く</Button></View>
    {!!toast && <View style={{ backgroundColor: '#E8EEE5', borderRadius: 12, padding: 12, gap: 6 }}><Text accessibilityRole="status" accessibilityLiveRegion="polite" style={s.link}>{toast.message}</Text>{toast.blueskyUrl && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(toast.blueskyUrl!)}><Text style={s.link}>Blueskyで確認 ↗</Text></Pressable>}</View>}
    <View style={s.between}><View style={s.row}><Button subtle={mine} onPress={() => setMine(false)}>みんなの感想</Button>{identity && <Button subtle={!mine} onPress={() => setMine(true)}>自分の感想</Button>}</View><Pressable accessibilityRole="button" disabled={loading} onPress={() => void refresh()}><Text style={s.link}>更新 ↻</Text></Pressable></View>
    {!identity && <View style={s.bookLink}><View style={s.grow}><Text style={s.bookTitle}>あなたの感想も、ここに。</Text><Text style={s.note}>レビューを書くにはBlueskyと接続します。</Text></View><Button subtle onPress={() => router.push('/compose-review' as Href)}>接続する ↗</Button></View>}
    {error ? <View style={s.section}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button subtle onPress={() => void refresh()}>再試行</Button></View> : null}
    {loading && !data && <Text style={s.note}>感想を読み込んでいます…</Text>}
    {data && data.reviews.length === 0 && <View style={[s.card, s.empty]}><Text style={{ fontSize: 36, color: '#386149' }}>▤</Text><Text style={s.heading}>{mine ? 'まだ感想がありません' : '最初の感想を書いてみませんか'}</Text><Text style={s.note}>読み終えた気持ちも、途中で出会った一文も。</Text><Button onPress={() => router.push('/compose-review' as Href)}>本を選んで書く</Button></View>}
    {data?.reviews.map(review => <ReviewCard key={review.uri} review={review} own={identity?.did === review.did} />)}
    {data?.next != null && <Button subtle disabled={loading} onPress={() => void more()}>{loading ? '読み込み中…' : 'もっと読む'}</Button>}
  </ScrollView></SafeAreaView>;
}
