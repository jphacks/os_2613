import type { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { loopbackClientId, loginError } from './login-input.mjs';
export type Identity = { did: string; handle: string; name: string };
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
    return { did, handle: data.handle || did, name: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : 'Blueskyユーザー' };
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
export async function signIn(input: string): Promise<Identity | null> {

  if (window.location.hostname === 'localhost') {
    window.location.assign(`http://[::1]:${window.location.port}/settings?connect=1`);
    return null;
  }
  try {
    await restoreIdentity();
    await (await getClient()).signInRedirect('https://bsky.social', { scope: 'atproto' });
    return null;
  } catch (error) { throw new Error(loginError(error)); }
}
export async function signOut() {
  const identity = await restoreIdentity();
  if (identity) await (await getClient()).revoke(identity.did);
  initialized = Promise.resolve(null);
}

export const loginAvailable = true;
