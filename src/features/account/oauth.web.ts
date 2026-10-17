import { avatarUrl } from '@/shared/avatar.mjs';
import { likeCollection, reviewCollection, reviewScope } from '../reviews/model.mjs';
import type { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { loopbackClientId, loginError } from './login-input.mjs';
export type Identity = { did: string; handle: string; name: string; avatar?: string };
let creating: Promise<BrowserOAuthClient> | undefined;
let initialized: Promise<Identity | null> | undefined;
// RouterがURLを操作する前の認証応答を保持。値をログや保存には出さない。
const initialUrl = typeof window === 'undefined' ? null : new URL(window.location.href);
let callbackHandled = false;
async function getClient() {
  if (!creating) creating = (async () => {
    const { BrowserOAuthClient } = await import('@atproto/oauth-client-browser');
    const loopback = ['127.0.0.1', '[::1]'].includes(window.location.hostname);
    const configured = process.env.EXPO_PUBLIC_ATPROTO_CLIENT_ID;
    if (!loopback && !configured) throw new Error('公開URLのOAuth設定がまだ完了していません。PCのローカルWeb版でお試しください。');
    return BrowserOAuthClient.load({ clientId: configured || loopbackClientId(window.location.origin), handleResolver: 'https://bsky.social', responseMode: 'fragment' });
  })().catch(error => { creating = undefined; throw error; });
  return creating;
}
async function profile(did: string): Promise<Identity> {
  try {
    const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
    if (!response.ok) throw new Error();
    const data = await response.json();
    return { did, handle: data.handle || did, avatar: avatarUrl(data.avatar), name: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : 'Blueskyユーザー' };
  } catch { return { did, handle: did, name: 'Blueskyユーザー' }; }
}
export function restoreIdentity(): Promise<Identity | null> {
  if (typeof window === 'undefined' || window.location.hostname === 'localhost') return Promise.resolve(null);
  if (!initialized) initialized = getClient().then(async client => {
    const params = new URLSearchParams(initialUrl?.hash.slice(1));
    const callback = !callbackHandled && params.has('state') && (params.has('code') || params.has('error'));
    callbackHandled = true;
    const callbackUri = client.clientMetadata.redirect_uris.find(uri => uri === `${initialUrl?.origin}/settings`);
    if (callback && !callbackUri) throw new Error('認証の戻り先が一致しません。');
    const result = callback ? await client.initCallback(params, callbackUri) : await client.initRestore();
    return result ? profile(result.session.sub) : null;
  }).catch(error => { initialized = undefined; throw new Error(loginError(error)); });
  return initialized;
}
async function popupIdentity(scope: string): Promise<Identity> {
  const popup = window.open('about:blank', 'dopabooks-auth', 'width=600,height=680,menubar=no,toolbar=no');
  if (!popup) throw new Error('Blueskyの認証画面を開けません。ブラウザーでポップアップを許可して、もう一度押してください。');
  try {
    const client = await getClient();
    const session = await client.signInPopup('https://bsky.social', { scope, popupName: 'dopabooks-auth', signal: AbortSignal.timeout(180000) });
    const identity = await profile(session.sub);
    initialized = Promise.resolve(identity);
    return identity;
  } finally { popup.close(); }
}
// Bluesky の決まりで、開発中のログインの戻り先は 127.0.0.1 でないといけない。
// localhost で開いているときは、同じ画面の 127.0.0.1 のアドレスへ移ってから、もう一度押してもらう。
function moveToLoopback() {
  if (window.location.hostname !== 'localhost') return false;
  const url = new URL(window.location.href);
  url.hostname = '127.0.0.1';
  window.location.assign(url.toString());
  return true;
}
const movingMessage = 'ログイン用のアドレス（127.0.0.1）に移動しています。開き直したら、もう一度ボタンを押してください。';

export async function signIn(_input: string): Promise<Identity | null> {
  if (moveToLoopback()) throw new Error(movingMessage);
  try { return await popupIdentity('atproto'); }
  catch (error) { if (error instanceof Error && /[ぁ-んァ-ン一-龠]/.test(error.message)) throw error; throw new Error(loginError(error)); }
}
export async function signOut() {
  const identity = await restoreIdentity();
  if (identity) await (await getClient()).revoke(identity.did);
  initialized = Promise.resolve(null);
}

export const loginAvailable = true;

async function reviewSession() {
  const identity = await restoreIdentity();
  if (!identity) throw new Error('Blueskyにログインしてください。');
  return (await getClient()).restore(identity.did);
}
export async function reviewAccess() {
  const info = await (await reviewSession()).getTokenInfo();
  const scopes = info.scope.split(' ');
  return { review: scopes.includes(`repo:${reviewCollection}`), like: scopes.includes(`repo:${likeCollection}`), bluesky: scopes.includes('repo:app.bsky.feed.post?action=create') || scopes.includes('repo:app.bsky.feed.post') };
}
export async function authorizeReviews(bluesky = false): Promise<Identity | null> {
  if (moveToLoopback()) throw new Error(movingMessage);
  try { return await popupIdentity(bluesky ? reviewScope : `atproto repo:${reviewCollection} repo:${likeCollection}`); }
  catch (error) { if (error instanceof Error && /[ぁ-んァ-ン一-龠]/.test(error.message)) throw error; throw new Error(loginError(error)); }
}
export function hasOAuthCallback() {
  const params = new URLSearchParams(initialUrl?.hash.slice(1));
  return params.has('state') && (params.has('code') || params.has('error'));
}
export async function reviewRequest(path: string, init?: RequestInit) {
  const session = await reviewSession();
  const response = await session.fetchHandler(path, init);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('投稿の許可を確認してください。「投稿を許可」から再接続できます。');
    const failure = await response.json().catch(() => ({}));
    if (failure.error === 'RecordNotFound') return null;
    const code = ['InvalidRecord', 'InvalidRequest', 'RateLimitExceeded', 'RecordAlreadyExists', 'UpstreamFailure'].includes(failure.error) ? `・${failure.error}` : '';
    throw new Error(`投稿の処理に失敗しました（HTTP ${response.status}${code}）。再試行してください。`);
  }
  return response.json();
}
