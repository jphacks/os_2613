import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeMetadata } from '../src/features/account/native-metadata.mjs';
test('ネイティブOAuthは公開ドメインを逆順にした専用スキームと最小の認証設定を使う', () => {
  const value = nativeMetadata('https://books.example.com/native.json');
  assert.deepEqual(value.redirect_uris, ['com.example.books:/auth/callback']);
  assert.equal(value.application_type, 'native');
  assert.equal(value.dpop_bound_access_tokens, true);
  assert.equal(value.token_endpoint_auth_method, 'none');
  assert.ok(!('client_secret' in value));
});
test('公開設定に秘密情報・非HTTPS・クエリ・ローカルIPを含めない', () => {
  for (const value of ['', 'http://example.com/client.json', 'https://user:pass@example.com/client.json', 'https://example.com/client.json?token=secret', 'https://example.com/client.json#fragment', 'https://127.0.0.1/client.json']) assert.throws(() => nativeMetadata(value));
});


test('環境変数がない開発PCでも公開認証URLと戻り先スキームを共有する', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { nativeOAuthClientId } = require('../config/oauth.cjs');
  const configure = require('../app.config.js');
  const previous = process.env.EXPO_PUBLIC_ATPROTO_NATIVE_CLIENT_ID;
  try {
    delete process.env.EXPO_PUBLIC_ATPROTO_NATIVE_CLIENT_ID;
    const metadata = nativeMetadata(nativeOAuthClientId);
    const config = configure({ config: { scheme: 'dopabooks', plugins: [], ios: {} } });
    assert.ok(config.scheme.includes('dopabooks'));
    assert.ok(config.scheme.includes(new URL(nativeOAuthClientId).hostname.split('.').reverse().join('.')));
    assert.ok(metadata.redirect_uris[0].endsWith(':/auth/callback'));
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_ATPROTO_NATIVE_CLIENT_ID;
    else process.env.EXPO_PUBLIC_ATPROTO_NATIVE_CLIENT_ID = previous;
  }
});
