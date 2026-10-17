import { AccountContext as Context, type Preferences, type Quest } from './context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { restoreIdentity, signIn, signOut, type Identity } from './oauth';
const defaults: Preferences = { name: 'ゲスト', nameChosen: false, music: true, comic: true, characters: true, quests: true, done: [] };
export function AccountProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null), [prefs, setPrefs] = useState(defaults), [ready, setReady] = useState(false), [error, setError] = useState('');
  const current = useRef(defaults), queue = useRef(Promise.resolve()), profileKey = useRef('guest'), loaded = useRef(false);
  useEffect(() => { let active = true; Promise.resolve().then(restoreIdentity).then(value => { if (active) setIdentity(value); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Blueskyに接続できません。'); }); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true; loaded.current = false; setReady(false); const owner = identity?.did || 'guest'; profileKey.current = owner;
    void AsyncStorage.getItem(`dopabooks:preferences:v1:${owner}`).then(raw => {
      const value = raw ? JSON.parse(raw) : {};
      const next = { ...defaults, name: identity?.name || defaults.name };
      if (typeof value.name === 'string' && value.name.trim()) next.name = value.name.slice(0, 40);
      next.nameChosen = value.nameChosen === true;
      for (const key of ['music', 'comic', 'characters', 'quests'] as const) if (typeof value[key] === 'boolean') next[key] = value[key];
      next.done = Array.isArray(value.done) ? value.done.filter((id: unknown) => ['add', 'read', 'bluesky', 'review', 'focus', 'widget'].includes(String(id))) : [];
      if (active) { current.current = next; setPrefs(next); loaded.current = true; }
    }).catch(() => { if (active) setError('設定を読み込めません。既存の設定は上書きしません。'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [identity?.did, identity?.name]);
  function update(patch: Partial<Preferences> | ((before: Preferences) => Partial<Preferences>)) {
    const owner = profileKey.current;
    const task = queue.current.then(async () => {
      if (!loaded.current || owner !== profileKey.current) throw new Error('設定の読み込み完了後にお試しください。');
      const next = { ...current.current, ...(typeof patch === 'function' ? patch(current.current) : patch) };
      await AsyncStorage.setItem(`dopabooks:preferences:v1:${owner}`, JSON.stringify(next));
      if (owner === profileKey.current) { current.current = next; setPrefs(next); }
    });
    queue.current = task.catch(() => {}); return task;
  }
  // 読書クエスト「Bluesky と連携」：ログインできたら完了
  useEffect(() => { if (identity && ready) complete('bluesky'); }, [identity, ready]);
  function complete(quest: Quest) { if (!loaded.current || current.current.done.includes(quest)) return; void update(before => ({ done: [...new Set([...before.done, quest])] })).catch(() => setError('クエストを保存できません。')); }
  return <Context.Provider value={{ identity, prefs, ready, error, update, complete, refreshIdentity: async () => { const value = await restoreIdentity(); setIdentity(value); }, login: async handle => { setError(''); const value = await signIn(handle); if (value) setIdentity(value); }, logout: async () => { await signOut(); setIdentity(null); } }}>{children}</Context.Provider>;
}
export function useAccount() { const value = useContext(Context); if (!value) throw new Error('AccountProviderが必要です'); return value; }
