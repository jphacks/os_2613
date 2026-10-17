import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSummaryEndpoint, createSummaryProvider, summaryConfiguration } from '../src/server/summary.mjs';
import { summaryFailure } from '../src/features/bookmark/summary-errors.mjs';

const request = (text, extra = {}) => new Request('http://localhost/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, ...extra }) });
test('設定確認はキーを返さず、空白だけの設定も未設定とする', () => {
  assert.deepEqual(summaryConfiguration(''), { configured: false });
  assert.deepEqual(summaryConfiguration('  '), { configured: false });
  assert.deepEqual(summaryConfiguration('private-test-value'), { configured: true });
});
test('設定・権限・上限・時間切れを区別し、任意のエラー文章は表示しない', async () => {
  for (const code of ['NOT_CONFIGURED', 'AUTH', 'RATE_LIMIT', 'BUSY', 'LIMIT', 'TIMEOUT']) {
    const endpoint = createSummaryEndpoint({ provider: async () => { throw new Error(code); } });
    const value = await (await endpoint(request('本文'))).json();
    assert.equal(value.code, code); assert.equal(summaryFailure(value.code).error, value.error);
  }
  assert.equal(summaryFailure('secret-value').code, 'UNKNOWN');
  assert.ok(!JSON.stringify(summaryFailure('secret-value')).includes('secret-value'));
  assert.equal(summaryFailure('__proto__').code, 'UNKNOWN');
});
test('外部サービスの拒否と時間切れを安全な原因コードに変える', async () => {
  for (const [status, code] of [[401, 'AUTH'], [403, 'AUTH'], [429, 'RATE_LIMIT']]) {
    const provider = createSummaryProvider({ apiKey: 'fake', fetcher: async () => ({ ok: false, status }) });
    await assert.rejects(provider('本文'), error => error.message === code);
  }
  await assert.rejects(createSummaryProvider({ apiKey: 'fake', fetcher: async () => { throw Object.assign(new Error('private'), { name: 'TimeoutError' }); } })('本文'), error => error.message === 'TIMEOUT');
});
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
