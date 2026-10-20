import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthRequest } from '../src/features/account/auth-request.mjs';
test('クリック中に直ちに認証を開始し、連打しても同じ処理を待つ', async () => {
  const run = createAuthRequest(); let calls = 0, finish;
  const first = run('login', () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  assert.equal(calls, 1);
  const second = run('login', () => { calls++; return Promise.resolve('duplicate'); });
  assert.equal(first, second); assert.equal(calls, 1);
  await assert.rejects(run('other-scope', () => Promise.resolve()), /認証画面が開いています/);
  finish('ok'); assert.equal(await second, 'ok');
  assert.equal(await run('login', () => Promise.resolve('again')), 'again');
});
test('キャンセルや同期エラーの後は次の認証を開始できる', async () => {
  const run = createAuthRequest();
  await assert.rejects(run('login', () => { throw new Error('cancel'); }), /cancel/);
  await assert.rejects(run('login', () => Promise.reject(new Error('network'))), /network/);
  assert.equal(await run('login', () => Promise.resolve('retry')), 'retry');
});
