import { reviewScope } from '../reviews/model.mjs';
export function nativeMetadata(clientId) {
  const url = new URL(clientId || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.hostname.includes('.') || url.hostname === 'localhost' || /^[\d.]+$/.test(url.hostname)) throw new Error('iPhone認証の公開HTTPS URLを確認してください。');
  const scheme = url.hostname.split('.').reverse().join('.');
  return {
    client_id: url.href, client_name: 'ドパBOOKs', client_uri: url.origin,
    redirect_uris: [`${scheme}:/auth/callback`], application_type: 'native', scope: reviewScope,
    token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'], dpop_bound_access_tokens: true,
  };
}
