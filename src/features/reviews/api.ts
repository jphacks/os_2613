import type { Review, ReviewStats } from './model.mjs';
export type ReviewFeed = { reviews: Review[]; next: number | null; total: number; stats: ReviewStats };
export async function loadReviews(params: { book?: string; did?: string; cursor?: number } = {}, signal?: AbortSignal): Promise<ReviewFeed> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
  const response = await fetch(`/api/reviews?${query}`, { signal: signal || AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'レビューを読み込めません。');
  return data;
}
export async function syncReview(uri: string) {
  const response = await fetch('/api/reviews', { method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uri }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'タイムラインに反映できません。再試行してください。');
}
