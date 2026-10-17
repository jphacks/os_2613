import AsyncStorage from '@react-native-async-storage/async-storage';
import { shareBluesky } from './bluesky-share.mjs';
import { reviewRequest, reviewAccess } from '@/features/account/oauth';
import { reviewCollection, reviewKey, validateReview, type ReviewRecord } from './model.mjs';
import { syncReview } from './api';
async function rpc(name: string, data: object) {
  return reviewRequest(`/xrpc/com.atproto.repo.${name}`, { method: 'POST', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
export async function ownReview(did: string, bookId: string): Promise<ReviewRecord | null> {
  const result = await reviewRequest(`/xrpc/com.atproto.repo.getRecord?${new URLSearchParams({ repo: did, collection: reviewCollection, rkey: reviewKey(bookId) })}`, { signal: AbortSignal.timeout(20000) });
  return result?.value ? validateReview(result.value) : null;
}
export async function publishReview(did: string, value: ReviewRecord, share: boolean) {
  const access = await reviewAccess();
  if (!access.review || (share && !access.bluesky)) throw new Error('投稿の許可が必要です。「投稿を許可」から接続してください。');
  const record = validateReview(value), rkey = reviewKey(record.book.id);
  const result = await rpc('putRecord', { repo: did, collection: reviewCollection, rkey, record, validate: false });
  if (!result?.uri) throw new Error('保存結果を確認できません。再試行してください。');
  let indexError = '', blueskyError = '', blueskyUrl = '';
  try { await syncReview(result.uri); } catch (error) { indexError = error instanceof Error ? error.message : 'タイムラインに反映できません。'; }
  if (share) {
    try {
      blueskyUrl = await shareBluesky({ did, review: record, request: reviewRequest, storage: AsyncStorage });
    } catch (error) { blueskyError = error instanceof Error ? error.message : 'Blueskyに共有できません。'; }
  }
  return { uri: result.uri as string, indexError, blueskyError, blueskyUrl };
}
export async function deleteReview(did: string, bookId: string) {
  const rkey = reviewKey(bookId);
  await rpc('deleteRecord', { repo: did, collection: reviewCollection, rkey });
  await syncReview(`at://${did}/${reviewCollection}/${rkey}`);
}
