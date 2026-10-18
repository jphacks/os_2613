import { findLoopbackOrigin } from '../features/account/login-input.mjs';

export function createLoopbackEndpoint({ probe } = {}) {
  return async request => {
    const url = new URL(request.url);
    const headers = { 'Cache-Control': 'no-store' };
    if (request.method !== 'GET') return Response.json({ error: 'METHOD' }, { status: 405, headers });
    const isLocal = value => value.protocol === 'http:' && ['localhost', '[::1]', '127.0.0.1'].includes(value.hostname) && value.port === url.port;
    let originAllowed = true;
    try { if (request.headers.get('origin')) originAllowed = isLocal(new URL(request.headers.get('origin'))); } catch { originAllowed = false; }
    if (!isLocal(url) || url.search || !originAllowed) {
      return Response.json({ error: 'ORIGIN' }, { status: 403, headers });
    }
    try {
      // 同じポートのループバックだけを調べる。任意のURLや認証情報は受け取らない。
      return Response.json({ origin: url.hostname === 'localhost' ? await findLoopbackOrigin(url.origin, probe) : url.origin }, { headers });
    } catch {
      return Response.json({ error: 'UNAVAILABLE' }, { status: 503, headers });
    }
  };
}
