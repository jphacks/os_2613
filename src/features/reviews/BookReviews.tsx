import { PullToRefresh } from './PullToRefresh';
import { NavigationButton } from '@/shared/NavigationButton';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { books as bundled } from '@/content/books';
import { useAccount } from '@/features/account/AccountProvider';
import { useLibrary } from '@/features/library/LibraryProvider';
import { Cover } from '@/features/shelf/Cover';
import { colors } from '@/shared/theme';
import { validBookId } from './model.mjs';
import { reviewBooks } from './books';
import { useReviewFeed } from './useReviewFeed';
import { Button, ReviewCard, s } from './ui';
export default function BookReviews({ bookId, close }: { bookId?: string; close?: () => void } = {}) {
  const params = useLocalSearchParams<{ id: string }>();
  const id = bookId || params.id;
  function navigate(path: Href) { close?.(); router.push(path); }
  const { books, addBook } = useLibrary(), { identity } = useAccount();
  const { data, loading, error, refresh, more } = useReviewFeed(validBookId(id) ? id : 'invalid');
  const [opening, setOpening] = useState(false), [readError, setReadError] = useState('');
  const local = books.find(book => book.id === id), study = bundled.find(book => book.id === id && book.kind === 'study');
  const book = reviewBooks(books).find(book => book.id === id) || data?.reviews[0]?.book;
  async function read() {
    if (opening || !validBookId(id)) return;
    if (local || study) { navigate(`/book/${id}` as Href); return; }
    setOpening(true); setReadError('');
    try {
      const response = await fetch(`/api/aozora?id=${id.replace('aozora-', '')}`), saved = await response.json();
      if (!response.ok || saved.id !== id) throw new Error('本を取得できません。もう一度お試しください。');
      await addBook(saved); navigate(`/book/${id}` as Href);
    } catch (e) { setReadError(e instanceof Error ? e.message : '本棚に追加できません。'); }
    finally { setOpening(false); }
  }
  return <View style={s.screen}>
    {close && <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 8 }}><Text style={s.heading}>本の紹介</Text><NavigationButton close label="閉じる" onPress={close} /></View>}
    <PullToRefresh refreshing={loading} onRefresh={refresh} style={s.screen} contentContainerStyle={[s.body, close ? { padding: 20, paddingTop: 8 } : { maxWidth: '100%' }]}>

    {!close && <Stack.Screen options={{ title: '本の紹介・レビュー', headerLeft: () => <NavigationButton onPress={() => router.canGoBack() ? router.back() : router.replace('/timeline')} /> }} />}
    {book ? <>
      <View style={[s.card, { gap: 24 }]}><View style={[s.row, { alignItems: 'flex-start', gap: 24 }]}><Cover width={96} title={book.title} author={book.author} label={study ? '教材' : '小説'} color={colors.accent} /><View style={[s.grow, { gap: 8, minWidth: 130 }]}><Text style={s.title}>{book.title}</Text><Text style={s.note}>{book.author}</Text><Text style={s.meta}>{study ? '公開教材・OE Japan' : '青空文庫'}</Text><Text style={{ color: colors.accent, fontSize: 28, marginTop: 6 }}>{data?.stats.average === null || !data ? '—' : data.stats.average.toFixed(1)} <Text style={{ fontSize: 16, color: colors.rating }}>★</Text></Text><Text style={s.meta}>{data?.stats.count || 0}人の評価</Text></View></View>
        <View style={s.row}><Button disabled={opening} onPress={() => void read()}>{opening ? '本を追加中…' : local || study ? '本を読む' : '本棚に追加して読む'}</Button><Button subtle onPress={() => navigate(`/compose-review?book=${id}` as Href)}>☆ 感想を書く</Button></View>
        {!!readError && <Text accessibilityRole="alert" style={s.error}>{readError}</Text>}
      </View>
      <View style={s.section}><Text style={s.heading}>この本について</Text>{local ? <Text style={s.reviewText}>{Array.from(local.text.trim()).slice(0, 220).join('')}…</Text> : <Text style={s.note}>{study ? `${book.author}による公開教材です。原本と学習用の表示で読み進められます。` : '青空文庫で公開されている作品です。本棚に追加して本文を読めます。'}</Text>}
        {local && <Text style={s.meta}>本文の書き出しより</Text>}{study?.source && <Pressable onPress={() => void Linking.openURL(study.source!)}><Text style={s.link}>公式の紹介・配布ページ ↗</Text></Pressable>}
      </View>
      <View style={s.card}><View style={s.between}><Text style={s.heading}>みんなの評価</Text><Text style={s.note}>{data?.stats.count || 0}件</Text></View>{[5, 4, 3, 2, 1].map(star => { const count = data?.stats.histogram[star - 1] || 0; return <View key={star} style={s.row}><Text style={[s.meta, { width: 30 }]}>{star} ★</Text><View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' }}><View style={{ height: 6, width: `${count / Math.max(1, data?.stats.count || 0) * 100}%`, backgroundColor: colors.rating }} /></View><Text style={[s.meta, { width: 26, textAlign: 'right' }]}>{count}</Text></View>; })}<Text style={s.meta}>ドパBOOKsに投稿された評価を、1人1件で集計しています。</Text></View>
    </> : !loading && !error ? <Text style={s.note}>本が見つかりません。本棚やタイムラインから選んでください。</Text> : null}
    <View style={s.between}><Text style={s.heading}>読者の感想</Text></View>
    {loading && !data && <Text style={s.note}>レビューを読み込んでいます…</Text>}
    {!!error && <View style={s.section}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button subtle onPress={() => void refresh()}>再試行</Button></View>}
    {data?.reviews.length === 0 && <View style={[s.card, s.empty]}><Text style={s.heading}>まだレビューはありません</Text><Text style={s.note}>この本の最初の感想を書いてみませんか。</Text></View>}
    {data?.reviews.map(review => <ReviewCard key={review.uri} review={review} own={identity?.did === review.did} hideBook beforeNavigate={close} />)}
    {data?.next != null && <Button subtle disabled={loading} onPress={() => void more()}>もっと読む</Button>}
  </PullToRefresh></View>;
}
