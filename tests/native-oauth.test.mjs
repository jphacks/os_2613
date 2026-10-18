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
