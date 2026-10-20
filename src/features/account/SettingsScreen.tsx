import { PageHeader } from '@/shared/PageHeader';
import { Avatar } from '@/shared/Avatar';
import { FeatureToggle } from '@/shared/FeatureToggle';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useAccount } from '@/features/account/AccountProvider';
import { loginAvailable, prepareSignIn, cancelSignIn } from '@/features/account/oauth';
import { colors } from '@/shared/theme';

export default function Settings({ embedded = false }: { embedded?: boolean }) {
  const { identity, prefs, ready, error, update, login, logout } = useAccount();
  const wide = useWindowDimensions().width >= 900;
  const params = useLocalSearchParams<{ connect?: string }>();
  const [tab, setTab] = useState('account'), [name, setName] = useState(prefs.name);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false);
  const [accountActions, setAccountActions] = useState(false);
  const [loopback, setLoopback] = useState(false);
  const [completeNotice, setCompleteNotice] = useState(false);
  const previousIdentity = useRef<string | null>(null);
  useEffect(() => { if (identity && previousIdentity.current !== identity.did) setCompleteNotice(true); if (!identity) setCompleteNotice(false); previousIdentity.current = identity?.did || null; }, [identity?.did]);
  useEffect(() => { if (ready) setName(prefs.name); }, [ready, identity?.did]);
  useEffect(() => {
    if (params.connect === '1') {
      router.setParams({ connect: undefined });
      setMessage('準備ができました。「Blueskyでサインインする」を押してください。');
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') setLoopback(['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname));
  }, [params.connect]);
  const acting = useRef(false);
  useEffect(() => {
    if (identity || tab !== 'account' || !loginAvailable) return;
    let active = true;
    void prepareSignIn().catch(reason => { if (active) { setFailed(true); setMessage(reason instanceof Error ? reason.message : '接続を準備できません。通信を確認してください。'); } });
    return () => { active = false; };
  }, [identity, tab]);
  async function act(action: () => Promise<void>) {
    if (acting.current) return;
    acting.current = true;
    setBusy(true); setMessage(''); setFailed(false);
    try { await action(); } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : '操作を完了できませんでした。'); }
    finally { acting.current = false; setBusy(false); }
  }
  const available = loginAvailable && (Platform.OS !== 'web' || loopback || !!process.env.EXPO_PUBLIC_ATPROTO_CLIENT_ID);
  if (identity && ready && !prefs.nameChosen) return <ScrollView style={s.screen} contentContainerStyle={s.onboarding} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ headerShown: false }} />
    <View style={s.welcome}>
      <Text style={s.eyebrow}>WELCOME TO ドパBOOKs</Text>
      <Text style={s.welcomeTitle}>なんて呼びましょう？</Text>
      <Text style={s.note}>認証が完了しました。ここで使うユーザー名を決めてください。</Text>
      <TextInput accessibilityLabel="ユーザー名" autoFocus value={name} onChangeText={setName} maxLength={40} placeholder="ユーザー名" style={s.input} onSubmitEditing={() => { if (name.trim() && !busy) void act(async () => { await update({ name: name.trim(), nameChosen: true }); router.dismissTo('/shelf'); }); }} />
      <Pressable accessibilityRole="button" disabled={busy || !name.trim()} onPress={() => void act(async () => { await update({ name: name.trim(), nameChosen: true }); router.dismissTo('/shelf'); })} style={[s.button, (busy || !name.trim()) && s.disabled]}><Text style={s.light}>{busy ? '保存中…' : 'この名前で始める　→'}</Text></Pressable>
      <Text style={s.footnote}>名前はあとから変更できます。Blueskyのプロフィールは変わりません。</Text>
      {!!(message || error) && <Text accessibilityRole="alert" style={s.note}>{message || error}</Text>}
    </View>
  </ScrollView>;
  return <View style={s.screen}>
    {!embedded && <PageHeader title="設定" backLabel="プロフィール" onBack={() => router.dismissTo('/profile')} />}
    <ScrollView style={s.screen} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
    {!embedded && <Stack.Screen options={{ headerShown: false }} />}
    <View style={[s.layout, wide && s.wideLayout]}>
    <View style={[s.tabs, wide && s.wideTabs]}>{[['account', 'アカウント'], ['features', '機能']].map(([id, label]) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === id }} key={id} onPress={() => setTab(id)} style={[s.tab, wide && s.wideTab, tab === id && s.selected]}><Text style={tab === id ? s.light : s.text}>{label}</Text></Pressable>)}</View>
    <View style={s.panel}>
    {tab === 'account' ? <>
      {identity ? <View style={s.profileCard}>
        <View style={s.row}><Text style={s.profileEyebrow}>BLUESKY ACCOUNT</Text><Text style={s.badge}>✓ 接続済み</Text></View>
        <Avatar uri={identity.avatar} size={64} /><Text style={s.profileName}>{prefs.nameChosen ? prefs.name : 'ようこそ、ドパBOOKsへ'}</Text>
        <Text selectable style={s.profileHandle}>@{identity.handle}</Text>
        {completeNotice && <Text accessibilityLiveRegion="polite" style={s.note}>Blueskyでの認証が完了しました。</Text>}
        <View style={s.divider} />
        <Text style={s.label}>{prefs.nameChosen ? 'アカウント名' : 'ドパBOOKsで使う名前を決めましょう'}</Text>
        <TextInput accessibilityLabel="ドパBOOKsのアカウント名" value={name} onChangeText={setName} maxLength={40} placeholder="読書で使う名前" style={s.input} />
        <Text style={s.note}>Blueskyの名前は変更されません。</Text>
        <Pressable accessibilityRole="button" disabled={busy || !ready || !name.trim()} onPress={() => void act(async () => { await update({ name: name.trim(), nameChosen: true }); setMessage('ユーザー名を変更しました。'); })} style={[s.button, (busy || !ready || !name.trim()) && s.disabled]}><Text style={s.light}>{prefs.nameChosen ? 'ユーザー名を変更' : 'この名前で始める　→'}</Text></Pressable>
        <View style={s.divider} />
        <Text style={s.label}>Blueskyのアカウント情報</Text>
        {[
          ['アカウントアドレス', `@${identity.handle}`, 'ハンドルを変更'],
          ['パスワード', 'Bluesky側で管理しています', 'パスワードを変更'],
          ['メールアドレス', '登録メールの確認・変更', 'メールアドレスを変更'],
        ].map(([label, detail, action]) => <Pressable key={label} accessibilityRole="link" accessibilityLabel={`${action}（Blueskyの設定を開く）`} onPress={() => void Linking.openURL('https://bsky.app/settings')} style={s.featureRow}><View style={s.grow}><Text style={s.featureTitle}>{label}</Text><Text style={s.featureDescription}>{detail}</Text></View><Text style={s.link}>変更 ↗</Text></Pressable>)}
        <Text style={s.note}>リンク先の「アカウント」から変更できます。メールアドレスやパスワードをドパBOOKsに保存する必要はありません。</Text>

        <Pressable accessibilityRole="button" accessibilityLabel="アカウントの操作" onPress={() => setAccountActions(!accountActions)} style={s.dismiss}><Text style={s.logout}>アカウントの操作　{accountActions ? '−' : '…'}</Text></Pressable>
        {accountActions && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(async () => { await logout(); setAccountActions(false); setMessage('ログアウトしました。'); })} style={s.dismiss}><Text style={s.logout}>ログアウト</Text></Pressable>}

      </View> : null}
      {!identity && <View style={s.loginCard}>

          <Text style={s.note}>いつものBlueskyアカウントで、読書を始めましょう。</Text>

          <Pressable accessibilityRole="button" disabled={busy || !ready || !available} onPress={() => void act(() => login(''))} style={[s.button, (busy || !ready || !available) && s.disabled]}>{busy ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator color={colors.surface} /><Text style={s.light}>認証画面で接続しています…</Text></View> : <Text style={s.light}>Blueskyでサインインする　↗</Text>}</Pressable>
          {busy && Platform.OS === 'web' && <Pressable accessibilityRole="button" onPress={cancelSignIn}><Text style={s.note}>接続を中止する</Text></Pressable>}
          {!available && <View style={s.example}><Text style={s.label}>ログインの接続設定が必要です</Text><Text style={s.note}>{Platform.OS === 'web' ? '公開Webの認証URLが未設定です。開発者がHTTPSのアプリ情報URLを設定すると利用できます。' : 'このiPhone版はまだ認証に接続していません。公開HTTPS URL・コールバック設定とビルドの更新が必要です。現在はゲストで利用できます。'}</Text></View>}

          <Text style={s.note}>アドレスとパスワードは、どちらも次のBluesky認証画面で入力します。認証後にアプリで使う名前を設定します。</Text>
          <View style={s.divider} />
          <Text style={s.label}>アカウントを持っていない方</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://bsky.app')} style={s.outline}><Text style={s.link}>Blueskyで新規登録 ↗</Text></Pressable>


        {loopback && <Text style={s.footnote}>開発用の初回接続ではURLが変わります。本棚は接続先ごとに保存されます。</Text>}
      </View>}
      <Text style={s.footnote}>感想は投稿画面で公開を選んだときだけ共有します。本棚としおりは端末内で共通保存され、端末間同期はしません。</Text>
    </> : <View style={s.card}>
      <Text style={s.section}>使いたい機能を選ぶ</Text>
      {([
        ['comic', '▤', '紹介4コマ', '読む前に、物語の入り口をのぞく'],
        ['quests', '✓', '読書クエスト', '本棚に操作ガイドを表示する'],

      ] as const).map(([key, icon, title, description]) => <View key={key} style={s.featureRow}>
        <View style={s.featureIcon}><Text style={s.featureSymbol}>{icon}</Text></View>
        <View style={s.grow}><Text style={s.featureTitle}>{title}</Text><Text style={s.featureDescription}>{description}</Text></View>
        <FeatureToggle label={title} value={prefs[key]} disabled={busy || !ready} onChange={value => void act(async () => { await update({ [key]: value }); setMessage(`${title}を${value ? 'ON' : 'OFF'}にしました。`); })} />
      </View>)}
    </View>}
    {!!(message || error) && <View style={s.feedback}><Text accessibilityRole={failed || (!message && !!error) ? 'alert' : undefined} accessibilityLiveRegion="polite" style={s.text}>{message || error}</Text>{failed && <Text style={s.note}>もう一度「Blueskyでサインインする」からお試しください。</Text>}</View>}
    </View></View>
  </ScrollView></View>;
}
const s = StyleSheet.create({
  layout: { gap: 20 }, wideLayout: { flexDirection: 'row', alignItems: 'flex-start' }, panel: { flex: 1, minWidth: 0, gap: 16 },
  wideTabs: { flexDirection: 'column', width: 230, flexShrink: 0, borderRadius: 18, padding: 8, backgroundColor: colors.surface }, wideTab: { flex: 0, alignItems: 'flex-start', paddingHorizontal: 18, paddingVertical: 16, borderRadius: 12 },
  onboarding: { flexGrow: 1, justifyContent: 'center', padding: 24 }, welcome: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 24 }, welcomeTitle: { fontSize: 30, color: colors.ink, fontWeight: '600' },
  profileCard: { backgroundColor: colors.surface, padding: 26, borderRadius: 16, gap: 16 }, profileEyebrow: { color: colors.muted, fontSize: 10, letterSpacing: 1.5 }, profileName: { color: colors.ink, fontSize: 32, fontWeight: '600', marginTop: 12 }, profileHandle: { color: colors.muted, fontSize: 14, marginBottom: 10 }, logout: { color: colors.muted, fontSize: 12 }, loginCard: { backgroundColor: colors.surface, padding: 26, borderRadius: 16, gap: 16 }, loginTitle: { color: colors.ink, fontSize: 25, fontWeight: '600', marginBottom: 2 },
  back: { alignSelf: 'flex-start', paddingVertical: 8 },
  success: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent, padding: 22, borderRadius: 14, gap: 14 }, successIcon: { backgroundColor: colors.accent, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }, successTick: { color: colors.surface, fontSize: 20 }, dismiss: { alignItems: 'center', padding: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.line }, featureIcon: { backgroundColor: colors.paper, width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' }, featureSymbol: { color: colors.accent, fontSize: 21 }, featureTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' }, featureDescription: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 3 },
  toggle: { width: 54, height: 32, borderRadius: 16, backgroundColor: colors.line, padding: 3 }, toggleOn: { backgroundColor: colors.accent }, toggleThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', boxShadow: '0 1px 4px rgba(41,46,41,0.15)' }, toggleTick: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  screen: { flex: 1, backgroundColor: colors.paper }, body: { padding: 24, paddingBottom: 48, gap: 16, width: '100%', flexGrow: 1 },
  eyebrow: { fontSize: 10, color: colors.accent, letterSpacing: 1.5 }, title: { fontSize: 28, color: colors.ink, marginTop: 6 },
  tabs: { flexDirection: 'row', gap: 4, backgroundColor: colors.line, padding: 4, borderRadius: 999 }, tab: { flex: 1, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 11, borderRadius: 999 }, selected: { backgroundColor: colors.accent },
  card: { backgroundColor: colors.surface, padding: 22, borderRadius: 12, gap: 14 }, section: { fontSize: 17, color: colors.ink, fontWeight: '600' }, badge: { color: colors.accent, fontSize: 11, backgroundColor: colors.paper, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  name: { fontSize: 26, color: colors.ink }, text: { color: colors.ink, fontSize: 14, lineHeight: 23 }, label: { color: colors.ink, fontSize: 13, fontWeight: '600' }, note: { color: colors.muted, fontSize: 12, lineHeight: 21 },
  inputRow: { flexDirection: 'row', gap: 8 }, grow: { flex: 1, minWidth: 0 }, input: { borderWidth: 1, borderColor: colors.line, borderRadius: 99999, padding: 13, fontSize: 15, color: colors.ink, backgroundColor: colors.surface },
  button: { backgroundColor: colors.accent, padding: 15, borderRadius: 99999, alignItems: 'center' }, smallButton: { backgroundColor: colors.accent, padding: 14, borderRadius: 99999, justifyContent: 'center' }, outline: { backgroundColor: colors.button, padding: 13, borderRadius: 99999, alignItems: 'center' },
  light: { color: colors.surface, fontSize: 14 }, link: { color: colors.accent, fontSize: 13 }, disabled: { opacity: 0.4 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 6 }, loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  example: { backgroundColor: colors.paper, padding: 14, borderRadius: 99999, gap: 5 }, exampleLabel: { color: colors.muted, fontSize: 10 }, exampleHandle: { color: colors.accent, fontSize: 16 }, footnote: { color: colors.muted, fontSize: 11, lineHeight: 20, paddingHorizontal: 6 }, feedback: { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.accent, padding: 16, gap: 8, borderRadius: 6 },
});
