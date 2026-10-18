import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHandle, loopbackClientId, findLoopbackOrigin, loginError } from '../src/features/account/login-input.mjs';
import { createLoopbackEndpoint } from '../src/server/oauth-loopback.mjs';

test('同一オリジンAPIからだけ同じポートのループバックを確認し、任意URLは拒否する', async () => {
  const calls = [];
  const endpoint = createLoopbackEndpoint({ probe: async url => calls.push(url) });
  const result = await endpoint(new Request('http://localhost:8081/api/oauth-loopback'));
  assert.equal(result.status, 200); assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await result.json(), { origin: 'http://[::1]:8081' });
  assert.deepEqual(calls, ['http://[::1]:8081/status']);
  assert.deepEqual(await (await endpoint(new Request('http://[::1]:8081/api/oauth-loopback'))).json(), { origin: 'http://[::1]:8081' });
  for (const url of ['http://example.com/api/oauth-loopback', 'https://localhost:8081/api/oauth-loopback', 'http://localhost:8081/api/oauth-loopback?url=http://example.com']) assert.equal((await endpoint(new Request(url))).status, 403);
  assert.equal((await endpoint(new Request('http://localhost:8081/api/oauth-loopback', { headers: { Origin: 'https://example.com' } }))).status, 403);
  assert.equal(calls.length, 1);
  const failed = createLoopbackEndpoint({ probe: async () => { throw Error('private-details'); } });
  const failure = await failed(new Request('http://localhost:8081/api/oauth-loopback'));
  assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes('private-details'));
});

test('IPv6だけの待受とIPv4へのフォールバックを確認し、接続不能な先へ移動しない', async () => {
  const calls = [];
  assert.equal(await findLoopbackOrigin('http://localhost:8081', async url => calls.push(url)), 'http://[::1]:8081');
  assert.deepEqual(calls, ['http://[::1]:8081/status']);
  assert.equal(await findLoopbackOrigin('http://localhost:8082', async url => { if (url.includes('[::1]')) throw Error('refused'); }), 'http://127.0.0.1:8082');
  await assert.rejects(findLoopbackOrigin('http://localhost:8081', async () => { throw Error('refused'); }), /開発サーバー/);
  assert.equal(await findLoopbackOrigin('https://example.com', async () => { throw Error('Unexpected request'); }), null);
});
test('ハンドルとプロフィールURLを正規化しメールアドレスを拒否する', () => {
  assert.equal(normalizeHandle(' @YourName.bsky.social '), 'yourname.bsky.social');
  assert.equal(normalizeHandle('https://bsky.app/profile/reader.example.com'), 'reader.example.com');
  assert.equal(normalizeHandle('reader.example.com'), 'reader.example.com');
  assert.throws(() => normalizeHandle('reader@example.com'), /メールアドレス/);
  assert.throws(() => normalizeHandle('reader'), /ハンドル全体/);
});
test('開発用client_idにパスを付けず設定画面をredirect_uriへ入れる', () => {
  const url = new URL(loopbackClientId('http://[::1]:8082'));
  assert.equal(url.origin, 'http://localhost');
  assert.equal(url.pathname, '/');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://[::1]:8082/settings');
  assert.match(url.searchParams.get('scope'), /repo:app\.dopabooks\.review/);
  assert.match(url.searchParams.get('scope'), /repo:app\.bsky\.feed\.post\?action=create/);
  assert.throws(() => loopbackClientId('https://example.com'));
});
test('認証エラーにURLや認証コードを表示しない', () => {
  const result = loginError(new Error('fetch failed code=private-value'));
  assert.match(result, /通信/); assert.ok(!result.includes('private-value'));
});
