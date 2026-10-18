import { nativeOAuthClientId } from '../../../config/oauth.cjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { avatarUrl } from '@/shared/avatar.mjs';
import { reviewCollection, likeCollection, reviewScope } from '../reviews/model.mjs';
import { nativeMetadata } from './native-metadata.mjs';
import type { ExpoOAuthClient, OAuthSession } from '@atproto/oauth-client-expo';
export type Identity = { did: string; handle: string; name: string; avatar?: string };
const didKey = 'dopabooks:native-oauth:did:v1';
const clientId = process.env.EXPO_PUBLIC_ATPROTO_NATIVE_CLIENT_ID || nativeOAuthClientId;
export const loginAvailable = !!clientId;
let creating: Promise<ExpoOAuthClient> | undefined;
let activeSession: OAuthSession | null = null;
let restoring: Promise<Identity | null> | undefined;
async function client() {
  if (!clientId) throw new Error('iPhone認証の公開URLが未設定です。');
  if (!creating) creating = (async () => {
    const { ExpoOAuthClient } = await import('@atproto/oauth-client-expo');
    return new ExpoOAuthClient({ clientMetadata: nativeMetadata(clientId), handleResolver: 'https://bsky.social' });
  })().catch(() => { creating = undefined; throw new Error('認証機能を開けません。最新のiPhone用ビルドをインストールしてください。'); });
  return creating;
}
async function identity(session: OAuthSession): Promise<Identity> {
  const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(session.sub)}`);
  if (!response.ok) throw new Error('プロフィールを取得できません。通信を確認して再試行してください。');
  const data = await response.json();
  return { did: session.sub, handle: data.handle || session.sub, name: data.displayName?.trim() || 'Blueskyユーザー', avatar: avatarUrl(data.avatar) };
}
export function restoreIdentity(): Promise<Identity | null> {
  if (!loginAvailable) return Promise.resolve(null);
  if (!restoring) restoring = (async () => {
    const did = await AsyncStorage.getItem(didKey);
    if (!did) return null;
    const restored = await (await client()).restore(did);
    activeSession = restored;
    return restored ? identity(restored) : null;
  })().catch(() => { restoring = undefined; throw new Error('ログインを復元できません。通信を確認するか、もう一度サインインしてください。'); });
  return restoring;
}
async function authenticate(scope: string): Promise<Identity> {
  try {
    const session = await (await client()).signIn('https://bsky.social', { scope });
    const value = await identity(session);
    await AsyncStorage.setItem(didKey, session.sub); // トークン・秘密鍵の保存と更新は公式SDKが管理する。
    activeSession = session; restoring = Promise.resolve(value);
    return value;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Authentication cancelled:')) throw new Error('サインインをキャンセルしました。');
    if (error instanceof Error && /[ぁ-んァ-ン一-龠]/.test(error.message)) throw error;
    throw new Error('Blueskyに接続できません。通信を確認して、もう一度お試しください。');
  }
}
export async function signIn(_handle: string): Promise<Identity | null> { return authenticate('atproto'); }
export async function signOut() {
  const did = activeSession?.sub || await AsyncStorage.getItem(didKey);
  if (did) await (await client()).revoke(did);
  await AsyncStorage.removeItem(didKey);
  activeSession = null; restoring = Promise.resolve(null);
}
async function session() {
  if (!activeSession) await restoreIdentity();
  if (!activeSession) throw new Error('Blueskyにサインインしてください。');
  return activeSession;
}
export async function reviewAccess() {
  const info = await (await session()).getTokenInfo(), scopes = info.scope.split(' ');
  return { review: scopes.includes(`repo:${reviewCollection}`), like: scopes.includes(`repo:${likeCollection}`), bluesky: scopes.includes('repo:app.bsky.feed.post?action=create') || scopes.includes('repo:app.bsky.feed.post') };
}
export async function authorizeReviews(bluesky = false): Promise<Identity | null> { return authenticate(bluesky ? reviewScope : `atproto repo:${reviewCollection} repo:${likeCollection}`); }
export async function reviewRequest(path: string, init?: RequestInit): Promise<any> {
  const response = await (await session()).fetchHandler(path, init);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('投稿の許可を確認してください。「投稿を許可」から再接続できます。');
    const failure = await response.json().catch(() => ({}));
    if (failure.error === 'RecordNotFound') return null;
    throw new Error(`投稿の処理に失敗しました（HTTP ${response.status}）。再試行してください。`);
  }
  return response.json();
}
export function hasOAuthCallback() { return false; }
