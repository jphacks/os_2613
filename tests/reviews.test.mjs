import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewCollection, validateReview, parseReviewUri, reviewStats, blueskyText, likeCollection, likeKey, parseLikeUri, validateLike } from '../src/features/reviews/model.mjs';
import { createReviewService, createReviewsEndpoint, verifyReview } from '../src/server/reviews.mjs';
const did = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
const uri = `at://${did}/${reviewCollection}/aozora-1567`;
const record = (patch = {}) => ({ $type: reviewCollection, book: { id: 'aozora-1567', title: '試験用の本', author: '著者' }, displayName: '読書家', rating: 4, text: 'よかった。', spoiler: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...patch });
const view = (patch = {}) => ({ ...record(), did, uri, handle: 'reader.test', ...patch });
const describe = async () => ({ id: 'aozora-1567', title: '公式の題名', author: '公式の著者' });
test('星は整数1〜5、本IDと文字数を検証する', () => {
  assert.equal(validateReview(record()).rating, 4);
  for (const rating of [0, 6, 2.5, '5']) assert.throws(() => validateReview(record({ rating })));
  assert.throws(() => validateReview(record({ text: 'あ'.repeat(2001) })));
  assert.throws(() => validateReview(record({ book: { id: '../../secret', title: 'x', author: 'y' } })));
  assert.deepEqual(parseReviewUri(uri), { did, rkey: 'aozora-1567' });
  assert.throws(() => parseReviewUri('https://localhost/private'));
  assert.throws(() => parseReviewUri(uri.replace('aozora-1567', '../private')));
});
test('同じ人・同じ本の最新版だけ集計し、別の本を混ぜない', () => {
  const data = [view(), view({ rating: 2, updatedAt: '2026-02-01T00:00:00.000Z' }), view({ did: 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb', rating: 5 })];
  assert.deepEqual(reviewStats(data), { count: 2, average: 3.5, histogram: [0, 1, 0, 0, 1] });
  assert.deepEqual(reviewStats([]), { count: 0, average: null, histogram: [0, 0, 0, 0, 0] });
});
test('Bluesky用テキストは短くし、ネタバレの本文を出さない', () => {
  const text = blueskyText(record({ text: '📖'.repeat(2000) }));
  assert.ok(Array.from(text).length <= 300);
  assert.match(text, /#ドパBOOKs/);
  assert.ok(!blueskyText(record({ spoiler: true, text: '秘密の結末' })).includes('秘密の結末'));
});
function fetcherFor({ endpoint = 'https://test.jp.host.bsky.network', responseUri = uri, status = 200, value = record() } = {}) {
  return async url => {
    if (url.startsWith('https://plc.directory/')) return Response.json({ id: did, service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: endpoint }] });
    if (url.includes('/com.atproto.repo.getRecord')) return Response.json(status === 400 ? { error: 'RecordNotFound' } : { uri: responseUri, value }, { status });
    if (url.startsWith('https://public.api.bsky.app/')) return Response.json({ handle: 'reader.test' });
    throw new Error('想定外の接続');
  };
}
test('所有者のPDSから再検証し、公式の本情報とハンドルを表示する', async () => {
  const verified = await verifyReview(uri, fetcherFor(), describe);
  assert.equal(verified.did, did); assert.equal(verified.handle, 'reader.test'); assert.equal(verified.book.title, '公式の題名');
  await assert.rejects(() => verifyReview(uri, fetcherFor({ responseUri: uri.replace('aaaa', 'bbbb') }), describe), /所有者/);
  await assert.rejects(() => verifyReview(uri, fetcherFor({ value: record({ book: { id: 'calculus', title: 'x', author: 'y' } }) }), describe), /一致/);
});
test('内部URL・リダイレクト誘導を拒否し、障害を削除扱いにしない', async () => {
  for (const endpoint of ['http://127.0.0.1', 'https://localhost/', 'https://bsky.social.evil.test/', 'https://bsky.social:8443/', 'https://bsky.social/private']) {
    await assert.rejects(() => verifyReview(uri, fetcherFor({ endpoint }), describe), /対応/);
  }
  assert.equal((await verifyReview(uri, fetcherFor({ status: 400 }), describe)).removed, true);
  await assert.rejects(() => verifyReview(uri, fetcherFor({ status: 503 }), describe), /確認/);
});
test('投稿の追加・更新・削除と、本別の全件集計を同期する', async () => {
  let saved = null, next = view();
  const storage = { read: async () => saved, update: async (_key, change) => { saved = change(saved); } };
  const service = createReviewService({ discover: async () => ({ reviews: [], warning: '' }), storage, verify: async () => next });
  await service.sync(uri); next = view({ rating: 1, updatedAt: '2026-02-01T00:00:00.000Z' }); await service.sync(uri);
  assert.equal((await service.list({ book: 'aozora-1567' })).stats.average, 1);
  assert.equal((await service.list()).total, 1);
  assert.equal((await service.list({ book: 'calculus' })).total, 0);
  next = { uri, removed: true }; await service.sync(uri);
  assert.equal((await service.list()).total, 0);
});
test('いいねは1人1件で数え、取り消すと減り、他人の感想と混ざらない', async () => {
  const other = 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb';
  const likeUri = (by, subject = uri) => `at://${by}/${likeCollection}/${likeKey(subject)}`;
  assert.equal(likeKey(uri), 'aaaaaaaaaaaaaaaaaaaaaaaa-aozora-1567');
  assert.throws(() => parseLikeUri('at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/app.dopabooks.like/../x'));
  assert.throws(() => validateLike({ $type: likeCollection, subject: 'https://evil.test', createdAt: '2026-01-01T00:00:00.000Z' }));
  // 保存の名前ごとに分けて持つ仮の保存先
  const store = new Map();
  const storage = { read: async key => store.get(String(key)) ?? null, update: async (key, change) => { store.set(String(key), change(store.get(String(key)) ?? null)); } };
  let likeState = {};
  const service = createReviewService({ discover: async () => ({ reviews: [], warning: '' }), storage, verify: async () => view(), verifyLikeRecord: async u => likeState[u] ?? { uri: u, removed: true } });
  await service.sync(uri);
  likeState[likeUri(did)] = { uri: likeUri(did), did, subject: uri };
  likeState[likeUri(other)] = { uri: likeUri(other), did: other, subject: uri };
  await service.sync(likeUri(did)); await service.sync(likeUri(other)); await service.sync(likeUri(other));
  let review = (await service.list()).reviews[0];
  assert.equal(review.likes, 2); assert.deepEqual(review.likedBy.sort(), [did, other].sort());
  delete likeState[likeUri(other)]; await service.sync(likeUri(other));
  review = (await service.list()).reviews[0];
  assert.equal(review.likes, 1); assert.deepEqual(review.likedBy, [did]);
  // 自分の画面の「いいね」タブ：いいねした人で絞ると、その人がいいねした感想だけが出る
  assert.equal((await service.list({ liked: did })).total, 1);
  assert.equal((await service.list({ liked: other })).total, 0);
});
test('共有APIは別オリジンの書込み・不正なIDを拒否する', async () => {
  let called = false;
  const endpoint = createReviewsEndpoint({ service: { list: async () => ({ reviews: [] }), sync: async () => { called = true; return { ok: true }; } } });
  const denied = await endpoint(new Request('https://app.test/api/reviews', { method: 'POST', headers: { Origin: 'https://other.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ uri }) }));
  assert.equal(denied.status, 403); assert.equal(called, false);
  assert.equal((await endpoint(new Request('https://app.test/api/reviews?book=bad'))).status, 400);
  assert.equal((await endpoint(new Request('https://app.test/api/reviews?cursor=-1'))).status, 400);
});
