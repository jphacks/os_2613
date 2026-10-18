import { artifactUrl } from '@/features/comic/api';
import { summaryLimit } from '@/features/bookmark/model.mjs';
import type { SavedBook } from '@/features/library/types';
import { listWidgetBooks, rememberWidgetBook } from './bookmarks';

// ウィジェット用の「まとめ」を自動で作る。
// 範囲は「最後に読んだ位置より前にある、一番近いしおり」から「最後に読んだ位置」まで。
// しおりが無ければ本の最初から。まだ読んでいない部分（最後に読んだ位置より後ろ）は含めない。
// 前回まとめた位置から読み進めた量が少ないときは作り直さない（API の利用料を抑えるため）。

const MIN_ADVANCE = 300; // これだけ読み進めたら、まとめを作り直す（文字数）
const running = new Set<string>(); // 同じ本の要約を同時に2回送らないため

export async function summarizeForWidget(book: SavedBook, cursor: number, marks: number[]) {
  if (cursor <= 0 || running.has(book.id)) return;
  const saved = (await listWidgetBooks()).find(item => item.bookId === book.id);
  if (saved && saved.summary && Math.abs(cursor - (saved.summaryOffset ?? 0)) < MIN_ADVANCE) return;

  // 1つ前のしおり（最後に読んだ位置より前で、一番近いもの）を始まりにする
  const start = Math.max(0, ...marks.filter(offset => offset < cursor));
  let text = book.text.slice(start, cursor);
  if (text.trim().length < 40) return; // 短すぎてまとめられない
  // 長すぎるときは、最後に読んだ位置に近い方を優先して送る
  if (text.length > summaryLimit) text = text.slice(text.length - summaryLimit);

  running.add(book.id);
  try {
    const response = await fetch(artifactUrl('/api/summary'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(55000),
    });
    const value = await response.json();
    if (!response.ok || typeof value?.summary !== 'string' || !value.summary.trim()) return;
    await rememberWidgetBook({ bookId: book.id, summary: value.summary.trim().slice(0, 1200), summaryOffset: cursor });
  } catch {
    // 通信できないときは、前のまとめのまま（次に本を閉じたときにまた試す）
  } finally {
    running.delete(book.id);
  }
}
