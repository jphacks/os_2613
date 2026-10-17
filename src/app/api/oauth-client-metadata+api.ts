// 公開WebのOAuthメタデータ。公開先確定後にURLを環境変数へ設定する。
export function GET() {
  const clientId = process.env.EXPO_PUBLIC_ATPROTO_CLIENT_ID;
  let url: URL;
  try { url = new URL(clientId || ''); } catch { return Response.json({ error: 'OAuthの公開URLは未設定です。' }, { status: 503 }); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return Response.json({ error: 'OAuthの公開URLを確認してください。' }, { status: 503 });
  return Response.json({
    client_id: url.href, client_name: 'ドパBOOKs', client_uri: url.origin,
    redirect_uris: [`${url.origin}/settings`], application_type: 'web', scope: 'atproto',
    token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'], dpop_bound_access_tokens: true,
  });
}
