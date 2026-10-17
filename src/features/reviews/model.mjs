export const reviewCollection = 'app.dopabooks.review';
export const reviewScope = `atproto repo:${reviewCollection} repo:app.bsky.feed.post?action=create`;
export const validBookId = id => typeof id === 'string' && /^(aozora-[1-9][0-9]{0,7}|calculus|thermodynamics|mathematics-for-economics|ai-for-teachers)$/.test(id);
const line = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
export function reviewKey(bookId) {
  if (!validBookId(bookId)) throw new Error('本を選び直してください。');
  return bookId;
}
export function validateReview(value) {
  if (!value || value.$type !== reviewCollection || !validBookId(value.book?.id) || !line(value.book.title, 200) || !line(value.book.author, 200)
    || !line(value.displayName, 40) || !Number.isInteger(value.rating) || value.rating < 1 || value.rating > 5
    || typeof value.text !== 'string' || value.text.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.text)
    || typeof value.spoiler !== 'boolean' || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt))
    || Date.parse(value.createdAt) > Date.parse(value.updatedAt) || Date.parse(value.updatedAt) > Date.now() + 300000) throw new Error('レビューの入力内容を確認してください。');
  return { $type: reviewCollection, book: { id: value.book.id, title: value.book.title.trim(), author: value.book.author.trim() },
    displayName: value.displayName.trim(), rating: value.rating, text: value.text.trim(), spoiler: value.spoiler, createdAt: new Date(value.createdAt).toISOString(), updatedAt: new Date(value.updatedAt).toISOString() };
}
export function parseReviewUri(uri) {
  const match = typeof uri === 'string' && uri.match(/^at:\/\/(did:plc:[a-z2-7]{24})\/app\.dopabooks\.review\/([a-z0-9-]{1,100})$/);
  if (!match || !validBookId(match[2])) throw new Error('レビューのアドレスが不正です。');
  return { did: match[1], rkey: match[2] };
}
// 同じアカウント・同じ本の最新版を1件として数える。表示名は本人判定に使わない。
export function latestReviews(items) {
  const unique = new Map();
  for (const item of items) {
    const key = `${item.did}:${item.book.id}`, previous = unique.get(key);
    if (!previous || item.updatedAt > previous.updatedAt) unique.set(key, item);
  }
  return [...unique.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.uri.localeCompare(b.uri));
}
export function reviewStats(items) {
  const reviews = latestReviews(items), count = reviews.length, histogram = [0, 0, 0, 0, 0];
  for (const review of reviews) histogram[review.rating - 1]++;
  return { count, average: count ? reviews.reduce((sum, item) => sum + item.rating, 0) / count : null, histogram };
}
export function blueskyText(review, legacy = false) {
  const title = Array.from(review.book.title).slice(0, 70).join('');
  const author = Array.from(review.book.author).slice(0, 50).join('');
  const header = legacy ? `『${title}』 ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}\n`
    : `📖『${title}』\n${author}\n\n${'⭐'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} ${review.rating}/5\n\n`;
  const body = review.spoiler ? 'ネタバレを含む感想をドパBOOKsに投稿しました。' : review.text;
  const footer = `${legacy ? '\n' : '\n\n'}#ドパBOOKs #読書記録`;
  const remaining = 280 - Array.from(header + footer).length;
  return header + (Array.from(body).length > remaining ? Array.from(body).slice(0, remaining - 1).join('') + '…' : body) + footer;
}
export function blueskyFacets(text) {
  const encoder = new TextEncoder();
  return ['ドパBOOKs', '読書記録'].map(tag => {
    const token = `#${tag}`, start = text.lastIndexOf(token);
    return { index: { byteStart: encoder.encode(text.slice(0, start)).length, byteEnd: encoder.encode(text.slice(0, start + token.length)).length },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag }] };
  });
}
