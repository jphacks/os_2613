import { NavigationButton } from '@/shared/NavigationButton';
import { Avatar } from '@/shared/Avatar';
import { FeatureToggle } from '@/shared/FeatureToggle';
import { setReviewNotice } from './notice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAccount } from '@/features/account/AccountProvider';
import { authorizeReviews, reviewAccess, loginAvailable } from '@/features/account/oauth';
import { useLibrary } from '@/features/library/LibraryProvider';
import { colors } from '@/shared/theme';
import { reviewBooks } from './books';
import { loadReviews } from './api';
import { reviewCollection, validateReview, type ReviewBook, type ReviewRecord } from './model.mjs';
import { deleteReview, ownReview, publishReview } from './publishing';
import { Button, Stars, s } from './ui';
type Result = Awaited<ReturnType<typeof publishReview>>;
export default function ComposeReview({ initialBookId, embedded = false }: { initialBookId?: string; embedded?: boolean } = {}) {
  const routeParams = useLocalSearchParams<{ book?: string }>();
  const params = { ...routeParams, book: initialBookId ?? routeParams.book };
  const { identity, prefs, ready: accountReady, refreshIdentity, update, complete } = useAccount(), { books, ready } = useLibrary();
  const [choosing, setChoosing] = useState(false), [displayName, setDisplayName] = useState('');
  useEffect(() => { if (accountReady) setDisplayName(prefs.name); }, [accountReady, identity?.did]);
  const [bookId, setBookId] = useState(''), [extra, setExtra] = useState<ReviewBook[]>([]), [query, setQuery] = useState('');
  const [rating, setRating] = useState(0), [text, setText] = useState(''), [spoiler, setSpoiler] = useState(false), [share, setShare] = useState(false);
  const [checkedBook, setCheckedBook] = useState('');
  const [access, setAccess] = useState({ review: false, bluesky: false }), [loaded, setLoaded] = useState(false), [checking, setChecking] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [result, setResult] = useState<Result | null>(null), [existing, setExisting] = useState(false), [remove, setRemove] = useState(false);
  const created = useRef(''), lastRecord = useRef<ReviewRecord | null>(null), booted = useRef(false), locked = useRef(false);
  const key = `dopabooks:review-draft:v1:${identity?.did || 'guest'}`;
  const choices = [...reviewBooks(books), ...extra.filter(item => !reviewBooks(books).some(book => book.id === item.id))];
  const selected = choices.find(book => book.id === bookId);
  useEffect(() => {
    let active = true; setLoaded(false); booted.current = false;
    setRating(0); setText(''); setSpoiler(false); setShare(false); setResult(null); setExisting(false); setCheckedBook('');
    lastRecord.current = null; created.current = '';
    void AsyncStorage.getItem(key).then(raw => {
      if (!active) return;
      const draft = raw ? JSON.parse(raw) : null;
      const id = params.book || draft?.bookId || '';
      setBookId(id);
      if (draft && draft.bookId === id) { setRating(Number.isInteger(draft.rating) && draft.rating >= 1 && draft.rating <= 5 ? draft.rating : 0); setText(typeof draft.text === 'string' ? draft.text.slice(0, 2000) : ''); setSpoiler(draft.spoiler === true); setShare(draft.share === true); booted.current = true; }
      if (id) void loadReviews({ book: id }).then(data => { if (active && data.reviews[0]) setExtra([data.reviews[0].book]); }).catch(() => {});
    }).catch(() => { if (active) setError('下書きを読み込めません。'); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [key, params.book]);
  useEffect(() => {
    let active = true;
    if (!identity) { setAccess({ review: false, bluesky: false }); return; }
    void reviewAccess().then(value => { if (active) setAccess(value); }).catch(() => { if (active) setError('投稿の許可を確認できません。再接続してください。'); });
    return () => { active = false; };
  }, [identity?.did]);
  useEffect(() => {
    let active = true;
    if (!loaded || !bookId || !identity || !loginAvailable) return;
    setCheckedBook(''); setChecking(true); setExisting(false); created.current = '';
    void ownReview(identity.did, bookId).then(record => {
      if (!active) return;
      setCheckedBook(bookId);
      if (!record) return;
      setExisting(true); created.current = record.createdAt;
      if (!booted.current) { setRating(record.rating); setText(record.text); setSpoiler(record.spoiler); }
      if (!choices.some(book => book.id === record.book.id)) setExtra(before => [...before.filter(book => book.id !== record.book.id), record.book]);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : '保存済みの感想を確認できません。'); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [loaded, bookId, identity?.did]);
  useEffect(() => {
    if (!loaded || result && !result.indexError && !result.blueskyError) return;
    const timer = setTimeout(() => { void AsyncStorage.setItem(key, JSON.stringify({ bookId, rating, text, spoiler, share })).catch(() => setError('下書きを保存できません。')); }, 300);
    return () => clearTimeout(timer);
  }, [loaded, key, bookId, rating, text, spoiler, share, result]);
  function choose(id: string) { setChoosing(false); booted.current = false; lastRecord.current = null; setBookId(id); setRating(0); setText(''); setSpoiler(false); setError(''); setResult(null); setRemove(false); }
  async function permit() {
    setBusy(true); setError('');
    try {
      const draft = JSON.stringify({ bookId, rating, text, spoiler, share });
      // 認証の窓は、ボタンを押した直後（待ち時間の前）に開かないとブラウザーに止められるので、先に呼び出す
      const authorizing = authorizeReviews(share);
      await AsyncStorage.setItem(key, draft);
      const connected = await authorizing;
      if (connected) {
        await AsyncStorage.setItem(`dopabooks:review-draft:v1:${connected.did}`, draft);
        await refreshIdentity();
        setAccess(await reviewAccess());
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : '接続できません。'); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (locked.current || !identity || !selected || !rating) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (!prefs.nameChosen) { if (!displayName.trim()) throw new Error('表示名を入力してください。'); await update({ name: displayName.trim(), nameChosen: true }); }
      const now = new Date().toISOString();
      const record = lastRecord.current ?? validateReview({ $type: reviewCollection, book: selected, displayName: prefs.nameChosen ? prefs.name : displayName.trim(), rating, text, spoiler, createdAt: created.current || now, updatedAt: now });
      lastRecord.current = record;
      const next = await publishReview(identity.did, record, share); complete('review'); setResult(next); setExisting(true); created.current = record.createdAt;
      if (!next.indexError && !next.blueskyError) {
        await AsyncStorage.removeItem(key).catch(() => {});
        setReviewNotice(share ? 'BlueskyとドパBOOKsに投稿しました' : 'ドパBOOKsに投稿しました', next.blueskyUrl || undefined);
        router.dismissTo('/timeline');
      }
    } catch (e) { setError(e instanceof Error ? e.message : '投稿できません。下書きは残っています。'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function erase() {
    if (locked.current || !identity || !bookId) return;
    locked.current = true; setBusy(true); setError('');
    try { await deleteReview(identity.did, bookId); await AsyncStorage.removeItem(key); router.replace(`/reviews/${bookId}` as Href); }
    catch (e) { setError(e instanceof Error ? e.message : '削除できません。'); }
    finally { locked.current = false; setBusy(false); }
  }
  const allowed = access.review && (!share || access.bluesky);
  return <ScrollView style={s.screen} contentContainerStyle={[s.body, { maxWidth: '100%' }]} keyboardShouldPersistTaps="handled">
    {!embedded && <Stack.Screen options={{ title: '感想を書く', headerLeft: () => <NavigationButton label="タイムライン" onPress={() => router.dismissTo('/timeline')} /> }} />}
    <>
      <View style={s.between}><Text style={embedded ? s.heading : s.title}>{existing ? '感想を編集する' : '感想を書く'}</Text>{identity && <View style={s.row}><Avatar uri={identity.avatar} size={32} /><Text style={s.note}>{prefs.nameChosen ? prefs.name : identity.name}</Text></View>}</View>
      {!identity && <View style={s.card}><Text style={s.heading}>Blueskyと接続して投稿</Text><Text style={s.note}>閲覧はログインなしでできます。投稿にはアカウントが必要です。</Text><Button disabled={busy || !loginAvailable || !loaded} onPress={() => void permit()}>{busy ? '接続中…' : 'Blueskyでサインインする ↗'}</Button>{!loginAvailable && <Text style={s.error}>iPhone のアプリからのサインインは準備中です。PC のブラウザーでお試しください。</Text>}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}</View>}
      <View style={s.section}><Text style={s.heading}>本</Text>
        {selected && <View style={[s.bookLink, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }]}><View style={s.miniBook}><Text style={s.miniBookText}>本</Text></View><View style={s.grow}><Text style={s.bookTitle}>{selected.title}</Text><Text style={s.note}>{selected.author}</Text></View><Button subtle disabled={embedded || busy || !!result} onPress={() => setChoosing(value => !value)}>{choosing ? '閉じる' : '変更'}</Button></View>}
        {(!selected || choosing) && <View style={{ gap: 8 }}><TextInput accessibilityLabel="本棚のタイトルや著者で絞り込む" value={query} onChangeText={setQuery} placeholder="タイトル・著者で探す" placeholderTextColor={colors.muted} style={s.input} editable={!busy && !result} />
          <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled><View style={{ gap: 6 }}>{choices.filter(book => book.id !== bookId && (!query || `${book.title} ${book.author}`.includes(query))).map(book => <Pressable accessibilityRole="button" accessibilityLabel={`${book.title}を選択`} disabled={busy || !!result} key={book.id} onPress={() => choose(book.id)} style={{ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 12 }}><Text style={s.bookTitle}>{book.title}</Text><Text style={s.meta}>{book.author}</Text></Pressable>)}</View></ScrollView>
        </View>}
        {ready && choices.length === 0 && <Button subtle onPress={() => router.push('/add')}>本棚に本を追加</Button>}
      </View>
      {identity && accountReady && !prefs.nameChosen && <View style={s.section}><Text style={s.note}>投稿に使う表示名</Text><TextInput accessibilityLabel="投稿に使う表示名" value={displayName} onChangeText={setDisplayName} maxLength={40} style={s.input} /></View>}
      <View style={s.card}><Text style={s.heading}>この本、どうだった？</Text><Stars value={rating} disabled={busy || checking || !!result} onChange={value => { lastRecord.current = null; setRating(value); }} /><Text style={s.note}>{rating ? `${rating} / 5` : '星をタップして評価'}</Text>
        <TextInput accessibilityLabel="本の感想" value={text} onChangeText={value => { lastRecord.current = null; setText(value); }} placeholder="好きだったところ、誰かに伝えたいこと…" placeholderTextColor={colors.muted} multiline maxLength={2000} editable={!busy && !checking && !result} style={[s.input, { minHeight: 160, textAlignVertical: 'top' }]} /><Text style={[s.meta, { textAlign: 'right' }]}>{text.length} / 2000</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Text style={s.note}>ネタバレを含む</Text><FeatureToggle label="ネタバレを含む" disabled={busy || checking || !!result} value={spoiler} onChange={value => { lastRecord.current = null; setSpoiler(value); }} /></View>
      </View>
      <View style={s.card}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ flexShrink: 1 }}><Text style={s.bookTitle}>Blueskyにも投稿</Text><Text style={s.note}>題名・星・感想の抜粋を共有</Text></View><FeatureToggle label="Blueskyにも投稿" disabled={busy || !!result} value={share} onChange={setShare} /></View><Text style={s.meta}>{spoiler ? 'ネタバレの本文はBlueskyに載せません。' : '長い感想は短くしてBlueskyに投稿します。'}</Text></View>
      <Text style={s.note}>投稿すると感想・星・表示名がAT Protocol上で公開されます。同じ本への評価は更新され、集計は1人1件です。</Text>
      {identity && !loginAvailable && <Text style={s.error}>投稿は現在Web版に対応しています。</Text>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {result && <View style={s.card}><Text style={s.heading}>AT Protocolには保存済みです</Text>{!!result.indexError && <Text style={s.error}>タイムラインへの反映：{result.indexError}</Text>}{!!result.blueskyError && <Text style={s.error}>Blueskyへの共有：{result.blueskyError}</Text>}<Button disabled={busy} onPress={() => void submit()}>同じ内容で再試行</Button></View>}
      {!result && (identity && !allowed ? <Button disabled={busy || !loginAvailable || !loaded} onPress={() => void permit()}>{busy ? '接続中…' : '投稿を許可する ↗'}</Button> : <Button disabled={busy || checking || !identity || !selected || !rating || !loaded || !accountReady || !loginAvailable || checkedBook !== bookId} onPress={() => void submit()}>{busy ? '投稿しています…' : checking ? '保存済みの感想を確認中…' : share ? '両方に投稿する' : existing ? 'ドパBOOKsの感想を更新' : 'ドパBOOKsに投稿する'}</Button>)}
      {existing && !result && <View style={s.section}>{remove ? <><Text style={s.note}>この本へのレビューと星評価を削除します。Blueskyへ共有した投稿は、Bluesky側で削除できます。</Text><View style={s.row}><Button subtle disabled={busy} onPress={() => setRemove(false)}>やめる</Button><Button disabled={busy} onPress={() => void erase()}>レビューを削除</Button></View></> : <Pressable onPress={() => setRemove(true)}><Text style={s.meta}>このレビューを削除する</Text></Pressable>}</View>}
    </>
  </ScrollView>;
}
