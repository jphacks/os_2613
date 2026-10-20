import { requireNativeModule } from 'expo';

// 認証用に導入済みのネイティブモジュールを使い、ブラウザーのcryptoに依存しない。
export async function shareDigest(value: string): Promise<string> {
  const module = requireNativeModule<{ digest(data: Uint8Array, algorithm: string): Promise<Uint8Array> }>('ExpoAtprotoOAuthClient');
  const bytes = await module.digest(new TextEncoder().encode(value), 'SHA-256');
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
