import { blueskyText, blueskyFacets } from '../src/features/reviews/model.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blueskyTid, shareBluesky } from '../src/features/reviews/bluesky-share.mjs';
const review = { book: { id: 'aozora-1567', title: '試験用の本', author: '著者' }, rating: 4, text: '感想', spoiler: false };
const did = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
test('Bluesky投稿IDは独自文字列ではなく13文字のTIDにする', () => {
  const tid = blueskyTid(Date.parse('2026-01-01T00:00:00Z'), 7);
  assert.match(tid, /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/);
  assert.equal(tid.length, 13);
  assert.ok(!tid.includes('-'));
  assert.throws(() => blueskyTid(-1));
  assert.throws(() => blueskyTid(Date.now(), 1024));
});
test('送信成功後に応答が失われても、画面を開き直した再試行で二重投稿しない', async () => {
  const cache = new Map(), posts = new Map(); let writes = 0;
  const storage = { getItem: async key => cache.get(key) ?? null, setItem: async (key, value) => { cache.set(key, value); } };
  const request = async (path, init) => {
    if (path.includes('getRecord')) return posts.get(new URLSearchParams(path.split('?')[1]).get('rkey')) ?? null;
    const body = JSON.parse(init.body);
    assert.match(body.rkey, /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/);
    assert.equal(body.collection, 'app.bsky.feed.post');
    assert.equal(body.record.dopabooksReview, `at://${did}/app.dopabooks.review/${review.book.id}`);
    assert.ok(cache.size > 0, '送信より前に再送用IDを保存する');
    posts.set(body.rkey, { value: body.record }); writes++;
    throw new Error('応答だけ切断');
  };
  await assert.rejects(() => shareBluesky({ did, review, request, storage, now: () => 1767225600000 }), /応答/);
  const url = await shareBluesky({ did, review, request, storage, now: () => 1767225900000 });
  assert.equal(writes, 1); assert.equal(posts.size, 1);
  assert.equal(url.split('/').at(-1), [...posts.keys()][0]);
});
test('再送IDを保存できない時は外部へ投稿しない', async () => {
  let calls = 0;
  await assert.rejects(() => shareBluesky({ did, review, storage: { getItem: async () => null, setItem: async () => { throw new Error('保存不可'); } }, request: async () => { calls++; } }), /保存/);
  assert.equal(calls, 0);
});

test('題名・著者・黄色い星・感想を段落で分け、日本語タグのUTF8範囲を正しく指定する', () => {
  const text = blueskyText(review);
  assert.ok(text.startsWith('📖『試験用の本』\n著者\n\n⭐⭐⭐⭐☆ 4/5\n\n感想\n\n'));
  const bytes = new TextEncoder().encode(text);
  for (const facet of blueskyFacets(text)) assert.equal(new TextDecoder().decode(bytes.slice(facet.index.byteStart, facet.index.byteEnd)), '#' + facet.features[0].tag);
});
test('旧レイアウトで公開済みの同じ感想は変更・二重投稿しない', async () => {
  let calls = 0;
  const storage = { getItem: async () => JSON.stringify({ key: blueskyTid(1767225600000), createdAt: '2026-01-01T00:00:00Z' }), setItem: async () => {} };
  await shareBluesky({ did, review, storage, request: async (_path, init) => { assert.ok(!init?.body); calls++; return { value: { text: blueskyText(review, true) } }; } });
  assert.equal(calls, 1);
});
