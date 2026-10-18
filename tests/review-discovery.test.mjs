import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlueskyDiscovery } from '../src/server/review-discovery.mjs';
import { createReviewService } from '../src/server/reviews.mjs';
const did = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', other = 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb';
const uri = `at://${did}/app.dopabooks.review/aozora-1567`;
const record = { $type: 'app.dopabooks.review', book: { id: 'aozora-1567', title: '走れメロス', author: '太宰 治' }, displayName: '読書家', rating: 4, text: 'あ'.repeat(1000), spoiler: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const post = (patch = {}) => ({ author: { did }, record: { text: '『走れメロス』 #ドパBOOKs', dopabooksReview: uri, ...patch } });
test('同じBluesky投稿の重複は1件にし、PDSの全文と星を使う。60秒以内は再取得しない', async () => {
  let searches = 0, verifies = 0;
  const discover = createBlueskyDiscovery({ search: async () => { searches++; return [post(), post()]; }, listReviews: async () => { throw Error('不要'); }, verify: async value => { verifies++; assert.equal(value, uri); return { ...record, uri, did }; } });
  const result = await discover();
  assert.equal(result.warning, ''); assert.equal(result.reviews[0].text.length, 1000); assert.equal(result.reviews[0].rating, 4);
  assert.deepEqual((await discover()).reviews, []); assert.equal(searches, 1); assert.equal(verifies, 1);
});
test('投稿者と異なる所有者・内部URL・タグなし投稿は取得しない', async () => {
  let verifies = 0;
  const discover = createBlueskyDiscovery({ search: async () => [post({ dopabooksReview: uri.replace(did, other) }), post({ dopabooksReview: 'http://localhost/private' }), post({ text: '無関係' })], listReviews: async () => [], verify: async () => { verifies++; } });
  assert.deepEqual((await discover()).reviews, []); assert.equal(verifies, 0);
});
test('過去の投稿は本人の本の題名と一致したレビューだけを採用する', async () => {
  const discover = createBlueskyDiscovery({ search: async () => [post({ dopabooksReview: undefined })], listReviews: async () => [{ uri, value: record }, { uri: uri.replace('1567', '789'), value: { ...record, book: { ...record.book, id: 'aozora-789', title: '別の本' } } }], verify: async value => ({ ...record, uri: value, did }) });
  assert.deepEqual((await discover()).reviews.map(item => item.uri), [uri]);
});
test('一部の所有者が応答しなくても他のレビューを残し、警告を返す', async () => {
  const discover = createBlueskyDiscovery({ search: async () => [post(), { author: { did: other }, record: { text: '#ドパBOOKs' } }], listReviews: async () => { throw Error('通信失敗'); }, verify: async () => ({ ...record, uri, did }) });
  const result = await discover(); assert.equal(result.reviews.length, 1); assert.ok(result.warning);
});
test('別のローカルサーバーの空の一覧にも発見したレビューが入り、本別集計に反映する', async () => {
  const data = new Map(); const storage = { read: async key => data.get(key), update: async (key, change) => { const value = change(data.get(key)); data.set(key, value); return value; } };
  let fail = false;
  const service = createReviewService({ storage, discover: async () => { if (fail) throw Error('通信失敗'); return { reviews: [{ ...record, uri, did }], warning: '' }; } });
  const result = await service.list({ book: 'aozora-1567' }); assert.equal(result.total, 1); assert.equal(result.stats.average, 4);
  fail = true; const fallback = await service.list(); assert.equal(fallback.total, 1); assert.ok(fallback.discoveryWarning);
});
