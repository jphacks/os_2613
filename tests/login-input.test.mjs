import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHandle, loopbackClientId, loginError } from '../src/features/account/login-input.mjs';
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
  assert.equal(url.searchParams.get('scope'), 'atproto');
  assert.throws(() => loopbackClientId('https://example.com'));
});
test('認証エラーにURLや認証コードを表示しない', () => {
  const result = loginError(new Error('fetch failed code=private-value'));
  assert.match(result, /通信/); assert.ok(!result.includes('private-value'));
});
