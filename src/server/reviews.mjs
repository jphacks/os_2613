import { avatarUrl } from '../shared/avatar.mjs';
import { createAozoraService } from './aozora.mjs';
import { artifactStorage, artifactKey, artifactInput } from './artifact-storage.mjs';
import { latestReviews, likeKey, parseLikeUri, parseReviewUri, reviewKey, validateLike, validateReview, reviewStats, validBookId } from '../features/reviews/model.mjs';
const globalKey = Symbol.for('dopabooks.reviews.v1');
const catalog = createAozoraService({ cachePath: '.local/aozora/catalog.zip' });
const studyInfo = {
  calculus: ['微分積分学', '吉田 伸生'], thermodynamics: ['熱力学', '冨田 博之'],
  'mathematics-for-economics': ['経済学のための数学', '原 千秋'],
  'ai-for-teachers': ['教師のためのAI入門', 'Colin de la Higuera・Jotsna Iyer（名古屋大学 訳）'],
};
async function canonicalBook(id) {
  if (id.startsWith('aozora-')) return catalog.describe(Number(id.slice(7)));
  const info = studyInfo[id];
  if (!info) throw new Error('本が見つかりません。');
  return { id, title: info[0], author: info[1] };
}

async function publicJson(fetcher, url) {
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  const reader = response.body.getReader(); let raw = '', bytes = 0; const decoder = new TextDecoder();
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 100000) { await reader.cancel(); throw new Error('応答が大きすぎます。'); } raw += decoder.decode(value, { stream: true }); }
    const data = JSON.parse(raw + decoder.decode());
    if (!response.ok) {
      if (response.status === 400 && data.error === 'RecordNotFound' && new URL(url).pathname === '/xrpc/com.atproto.repo.getRecord') return null;
      throw new Error('AT Protocolの公開データを確認できません。時間をおいて再試行してください。');
    }
    return data;
  } finally { reader.releaseLock(); }
}
// 投稿者が指定したURLへは接続しない。PLCが示すBluesky運営のPDSだけからレコードを読む。
async function pdsRecord(fetcher, did, collection, rkey) {
  const document = await publicJson(fetcher, `https://plc.directory/${did}`);
  const service = document?.service?.find(item => item.type === 'AtprotoPersonalDataServer');
  let pds; try { pds = new URL(service?.serviceEndpoint); } catch { throw new Error('アカウントの保存先が見つかりません。'); }
  if (document.id !== did || pds.protocol !== 'https:' || pds.username || pds.password || pds.port || pds.pathname !== '/' || pds.search || pds.hash
    || !(pds.hostname === 'bsky.social' || /^[a-z0-9-]+\.[a-z0-9-]+\.host\.bsky\.network$/.test(pds.hostname))) throw new Error('現在のレビュー共有はBluesky運営PDSのアカウントに対応しています。');
  const query = new URLSearchParams({ repo: did, collection, rkey });
  return publicJson(fetcher, `${pds.origin}/xrpc/com.atproto.repo.getRecord?${query}`);
}
// いいねの記録を確かめる。記録の名前が「いいねした感想」から決まる名前と一致するものだけを数える
export async function verifyLike(uri, fetcher = fetch) {
  const { did, rkey } = parseLikeUri(uri);
  const data = await pdsRecord(fetcher, did, 'app.dopabooks.like', rkey);
  if (!data) return { uri, did, removed: true };
  if (data.uri !== uri) throw new Error('いいねの所有者を確認できません。');
  const like = validateLike(data.value);
  if (likeKey(like.subject) !== rkey) throw new Error('いいねした感想とIDが一致しません。');
  return { uri, did, subject: like.subject };
}
export async function verifyReview(uri, fetcher = fetch, describe = canonicalBook) {
  const { did, rkey } = parseReviewUri(uri);
  const data = await pdsRecord(fetcher, did, 'app.dopabooks.review', rkey);
  if (!data) return { uri, removed: true };
  if (data.uri !== uri) throw new Error('投稿の所有者を確認できません。');
  const record = validateReview(data.value);
  if (reviewKey(record.book.id) !== rkey) throw new Error('本とレビューのIDが一致しません。');
  // 公開プロフィールのハンドルを使用し、リクエスト本文から投稿者を受け取らない。
  const book = await describe(record.book.id);
  const profile = await publicJson(fetcher, `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`).catch(() => null);
  return { ...record, book, did, uri, avatar: avatarUrl(profile?.avatar), handle: typeof profile?.handle === 'string' ? profile.handle.slice(0, 253) : did };
}
export function createReviewService({ storage = artifactStorage('.local/reviews'), verify = verifyReview, verifyLikeRecord = verifyLike } = {}) {
  const key = artifactKey(['review-index-v1']);
  const likesKey = artifactKey(['like-index-v1']);
  return {
    async list({ book, did, liked, cursor = 0 } = {}) {
      const all = latestReviews((await storage.read(key))?.items ?? []);
      const likes = (await storage.read(likesKey))?.items ?? [];
      const forBook = book ? all.filter(item => item.book.id === book) : all;
      const byAuthor = did ? forBook.filter(item => item.did === did) : forBook;
      // liked を付けると、その人がいいねした感想だけにする（自分の画面の「いいね」タブ用）
      const likedSubjects = liked ? new Set(likes.filter(like => like.did === liked).map(like => like.subject)) : null;
      const filtered = likedSubjects ? byAuthor.filter(item => likedSubjects.has(item.uri)) : byAuthor;
      const start = Math.max(0, cursor), limit = 30;
      // 感想ごとに、いいねの数と、いいねした人（自分が押したかの判定用）を付ける
      const withLikes = filtered.slice(start, start + limit).map(review => {
        const likedBy = likes.filter(like => like.subject === review.uri).map(like => like.did);
        return { ...review, likes: likedBy.length, likedBy: likedBy.slice(0, 500) };
      });
      return { reviews: withLikes, next: start + limit < filtered.length ? start + limit : null,
        stats: reviewStats(forBook), total: filtered.length };
    },
    async sync(uri) {
      // いいねの記録なら、いいねの一覧を更新する
      if (typeof uri === 'string' && uri.includes('/app.dopabooks.like/')) {
        parseLikeUri(uri);
        const like = await verifyLikeRecord(uri);
        await storage.update(likesKey, before => {
          const items = (before?.items ?? []).filter(item => item.uri !== uri);
          if (!like.removed) items.push(like);
          if (items.length > 50000) throw new Error('いいねの保存件数の上限です。管理者に確認してください。');
          return { items };
        });
        return { ok: true, removed: !!like.removed };
      }
      parseReviewUri(uri);
      const review = await verify(uri);
      await storage.update(key, before => {
        const items = (before?.items ?? []).filter(item => item.uri !== uri);
        if (!review.removed) items.push(review);
        if (items.length > 10000) throw new Error('レビュー保存件数の上限です。管理者に確認してください。');
        return { items: latestReviews(items) };
      });
      return { ok: true, removed: !!review.removed };
    },
  };
}
export function createReviewsEndpoint({ service, ...options } = {}) {
  if (!service) service = globalThis[globalKey] ??= createReviewService(options);
  let concurrent = 0;
  return async request => {
    const send = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
    try {
      if (request.method === 'GET') {
        const params = new URL(request.url).searchParams, book = params.get('book') || undefined, did = params.get('did') || undefined, liked = params.get('liked') || undefined;
        const cursor = Number(params.get('cursor') || 0);
        const validDid = value => /^did:plc:[a-z2-7]{24}$/.test(value);
        if ((book && !validBookId(book)) || (did && !validDid(did)) || (liked && !validDid(liked)) || !Number.isInteger(cursor) || cursor < 0 || cursor > 10000) throw new Error('検索条件を確認してください。');
        return send(await service.list({ book, did, liked, cursor }));
      }
      if (request.method !== 'POST') return send({ error: '操作を確認してください。' }, 405);
      const body = await artifactInput(request, 1000);
      if (typeof body.uri !== 'string') throw new Error('投稿のアドレスを確認してください。');
      if (concurrent >= 4) return send({ error: '共有処理が混み合っています。少し待って再試行してください。' }, 429);
      concurrent++;
      try { return send(await service.sync(body.uri)); } finally { concurrent--; }
    } catch (error) {
      const known = error?.message;
      return send({ error: known === 'ORIGIN' ? 'アプリの画面から操作してください。' : known === 'INVALID_INPUT' ? '入力内容を確認してください。' : known === 'STORAGE' ? 'タイムラインの保存先を確認してください。AT Protocolの投稿は残っています。' : /[ぁ-んァ-ン一-龠]/.test(known || '') ? known : 'レビューを取得できません。通信を確認して再試行してください。' }, known === 'ORIGIN' ? 403 : 400);
    }
  };
}
