import { parseReviewUri, validateReview } from '../features/reviews/model.mjs';
const didPattern = /^did:plc:[a-z2-7]{24}$/;
// 検索は入口だけに使い、本文・星は所有者のPDSで再検証する。
export function createBlueskyDiscovery({ search, listReviews, verify, now = Date.now }) {
  let pending, last = -Infinity, cached = { reviews: [], warning: '' };
  return async function discover() {
    if (pending) return pending;
    if (now() - last < (cached.warning ? 10000 : 60000)) return { reviews: [], warning: cached.warning };
    pending = (async () => {
      const signal = AbortSignal.timeout(12000), reviews = [], candidates = new Set();
      let failed = false;
      try {
        const posts = await search(signal);
        if (!Array.isArray(posts)) throw new Error('検索応答を確認できません。');
        const authors = new Map();
        for (const post of posts.slice(0, 50)) {
          const did = post.author?.did, record = post.record;
          if (!didPattern.test(did) || typeof record?.text !== 'string' || !record.text.includes('#ドパBOOKs')) continue;
          if (!authors.has(did) && authors.size >= 8) continue;
          if (!authors.has(did)) authors.set(did, []);
          authors.get(did).push(record);
        }
        await Promise.all([...authors].map(async ([did, posts]) => {
          try {
            let legacy = false;
            for (const post of posts) {
              if (post.dopabooksReview) {
                try { if (parseReviewUri(post.dopabooksReview).did === did) candidates.add(post.dopabooksReview); } catch { /* 外部の不正な参照は採用しない。 */ }
              } else legacy = true;
            }
            if (legacy) {
              for (const item of await listReviews(did, signal)) {
                try {
                  const value = validateReview(item.value);
                  if (parseReviewUri(item.uri).did === did && posts.some(post => !post.dopabooksReview && post.text.includes(`『${Array.from(value.book.title).slice(0, 70).join('')}』`))) candidates.add(item.uri);
                } catch { /* 本IDや所有者が一致しない記録は表示しない。 */ }
              }
            }
          } catch { failed = true; }
        }));
        const queue = [...candidates].slice(0, 20);
        await Promise.all(Array.from({ length: 4 }, async () => {
          while (queue.length && !signal.aborted) {
            const uri = queue.shift();
            try { reviews.push(await verify(uri, signal)); } catch { failed = true; }
          }
        }));
        if (signal.aborted || queue.length) failed = true;
      } catch { failed = true; }
      cached = { reviews, warning: failed ? 'Blueskyの投稿を一部取得できませんでした。少し待って更新してください。' : '' };
      last = now();
      return cached;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
