import { reviewScope } from '../reviews/model.mjs';
export function normalizeHandle(input) {
  let value = String(input ?? '').trim();
  if (/^https:\/\/(?:www\.)?bsky\.app\/profile\//i.test(value)) {
    try { value = new URL(value).pathname.split('/')[2] || ''; } catch { value = ''; }
  }
  value = value.replace(/^@/, '').toLowerCase();
  if (!value) throw new Error('Blueskyのハンドルを入力してください。');
  if (value.includes('@')) throw new Error('メールアドレスではなく、プロフィールの @ に続くハンドルを入力してください。');
  if (value.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(value)) throw new Error('ハンドル全体を入力してください（例：yourname.bsky.social）。独自ドメインも利用できます。');
  return value;
}
export function loopbackClientId(origin) {
  const url = new URL(origin);
  if (!['127.0.0.1', '[::1]'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('開発用ログインの接続先を確認してください。');
  return `http://localhost?${new URLSearchParams({ redirect_uri: `${url.origin}/settings`, scope: reviewScope })}`;
}
export async function findLoopbackOrigin(origin, probe = async url => {
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(2000) });
  if (!response.ok || (await response.text()).trim() !== 'packager-status:running') throw new Error('UNAVAILABLE');
}) {
  const current = new URL(origin);
  if (current.hostname !== 'localhost' || current.protocol !== 'http:') return null;
  for (const hostname of ['[::1]', '127.0.0.1']) {
    const url = new URL(current.origin); url.hostname = hostname;
    try { await probe(`${url.origin}/status`); return url.origin; } catch { /* IPv4・IPv6で待ち受けが異なる場合は次を確認する。 */ }
  }
  throw new Error('ログイン画面に接続できません。PCの開発サーバーが起動しているか確認してください。');
}
export function loginError(error) {
  const text = `${error?.name || ''} ${error?.message || ''}`;
  if (/denied|cancel|abort/i.test(text)) return 'ログインがキャンセルされました。もう一度お試しください。';
  if (/resolve|handle|DID|not found/i.test(text)) return 'アカウントが見つかりません。プロフィールのハンドル全体を確認してください。';
  if (/fetch|network|timeout|load failed/i.test(text)) return 'Blueskyに接続できません。通信を確認して、もう一度お試しください。';
  if (/storage|indexeddb|crypto|secure context/i.test(text)) return 'ブラウザーの保存・暗号化機能を利用できません。ChromeまたはSafariで開いてください。';
  return '認証を完了できませんでした。画面を再読み込みして、もう一度ログインしてください。';
}
