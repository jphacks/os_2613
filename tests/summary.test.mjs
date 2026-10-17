import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSummaryEndpoint, createSummaryProvider } from '../src/server/summary.mjs';

const request = (text, extra = {}) => new Request('http://localhost/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, ...extra }) });
test('要約には指定本文だけを渡し、作品名や未読本文を渡さない', async () => {
  const endpoint = createSummaryEndpoint({ provider: async text => { assert.equal(text, '読んだ本文。'); return 'まとめ。'; } });
  const response = await endpoint(request('読んだ本文。', { unread: '未来の結末', title: '作品名' }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { summary: 'まとめ。' });
});
test('空・不正JSON・2万文字超・外部サイト・過大な本文を拒否する', async () => {
  const endpoint = createSummaryEndpoint({ provider: async () => assert.fail('生成しない') });
  for (const text of ['', ' ', 'あ'.repeat(20001), null]) assert.equal((await endpoint(request(text))).status, 400);
  assert.equal((await endpoint(new Request('http://localhost/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await endpoint(new Request('http://localhost/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://other.example' }, body: '{}' }))).status, 403);
  assert.equal((await endpoint(request('あ'.repeat(50000)))).status, 413);
});
test('2万文字の境界は受け付け、同じ本文の連打は生成を共有する', async () => {
  let calls = 0;
  const endpoint = createSummaryEndpoint({ provider: async () => { calls++; return '要約'; } });
  const results = await Promise.all([endpoint(request('あ'.repeat(20000))), endpoint(request('あ'.repeat(20000)))]);
  assert.ok(results.every(result => result.status === 200)); assert.equal(calls, 1);
  await endpoint(request('あ'.repeat(20000))); assert.equal(calls, 1);
  await endpoint(request('短い本文')); assert.equal(calls, 2);
});
test('要約プロバイダーの内部エラーや秘密を公開せず、失敗を保存しない', async () => {
  let calls = 0;
  const endpoint = createSummaryEndpoint({ provider: async () => { if (++calls === 1) throw new Error('非公開の値'); return '要約'; } });
  const failure = await endpoint(request('本文'));
  assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes('非公開'));
  assert.equal((await endpoint(request('本文'))).status, 200); assert.equal(calls, 2);
});
test('実API用リクエストは選択本文のみ・保存なしで、未完了を拒否する', async () => {
  let calls = 0;
  const provider = createSummaryProvider({ apiKey: 'fake', fetcher: async (_, options) => {
    calls++; const body = JSON.parse(options.body);
    assert.equal(body.input, '本文'); assert.equal(body.store, false); assert.ok(!body.tools);
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'まとめ。\n\n次の段落。' }] }] }) };
  } });
  assert.equal(await provider('本文'), 'まとめ。\n\n次の段落。'); assert.equal(calls, 1);
  await assert.rejects(createSummaryProvider({ apiKey: '' })('本文'));
  await assert.rejects(createSummaryProvider({ apiKey: 'fake', fetcher: async () => ({ ok: true, json: async () => ({ status: 'incomplete' }) }) })('本文'));
});
