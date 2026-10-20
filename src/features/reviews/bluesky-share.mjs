import { blueskyText, blueskyFacets, reviewCollection, reviewKey } from './model.mjs';
const alphabet = '234567abcdefghijklmnopqrstuvwxyz';
export function blueskyTid(milliseconds, clock = 0) {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || !Number.isInteger(clock) || clock < 0 || clock > 1023) throw new Error('投稿日時を確認してください。');
  let value = BigInt(milliseconds) * 1000n * 1024n + BigInt(clock), result = '';
  if (value >= 1n << 63n) throw new Error('投稿日時を確認してください。');
  for (let i = 0; i < 13; i++) { result = alphabet[Number(value & 31n)] + result; value >>= 5n; }
  return result;
}
export async function shareBluesky({ did, review, request, storage, now = () => Date.now(), digest = async value => { const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join(''); } }) {
  const text = blueskyText(review);
  const hash = await digest(`${review.book.id}:${review.rating}:${review.spoiler}:${review.text}`);
  const cacheKey = `dopabooks:bluesky-share:v1:${did}:${hash}`;
  const raw = await storage.getItem(cacheKey);
  let publication;
  if (raw) {
    publication = JSON.parse(raw);
    if (!/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/.test(publication.key) || !Number.isFinite(Date.parse(publication.createdAt))) throw new Error('共有先の記録を読み込めません。保存内容を確認してください。');
  } else {
    const time = now();
    publication = { key: blueskyTid(time, parseInt(hash.slice(0, 3), 16) % 1024), createdAt: new Date(time).toISOString() };
    // 送信前に保存する。応答が途切れたり画面を開き直しても同じTIDで再試行する。
    await storage.setItem(cacheKey, JSON.stringify(publication));
  }
  const query = new URLSearchParams({ repo: did, collection: 'app.bsky.feed.post', rkey: publication.key });
  const existing = await request(`/xrpc/com.atproto.repo.getRecord?${query}`, { signal: AbortSignal.timeout(20000) });
  if (existing && existing.value?.text !== text && existing.value?.text !== blueskyText(review, true)) throw new Error('同じ投稿IDの内容が異なります。共有記録を確認してください。');
  if (!existing) {
    try { await request('/xrpc/com.atproto.repo.createRecord', {
    method: 'POST', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', rkey: publication.key, record: { $type: 'app.bsky.feed.post', dopabooksReview: `at://${did}/${reviewCollection}/${reviewKey(review.book.id)}`, text, facets: blueskyFacets(text), langs: ['ja'], tags: ['ドパBOOKs', '読書記録'], createdAt: publication.createdAt } }),
    }); } catch (error) {
      // 二重タップや応答切断の直後は作成済みになる。同じ内容が保存された場合だけ成功として扱う。
      const saved = await request(`/xrpc/com.atproto.repo.getRecord?${query}`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
      if (!saved || (saved.value?.text !== text && saved.value?.text !== blueskyText(review, true))) throw error;
    }
  }
  return `https://bsky.app/profile/${encodeURIComponent(did)}/post/${publication.key}`;
}
