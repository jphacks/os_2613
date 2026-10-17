export const summaryLimit = 20000;

// 画面のページ数ではなく本文の文字位置を保存し、表示の変化から独立させる。
export function documentVersion(text) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}
export function validOffset(text, offset) {
  return Number.isInteger(offset) && offset >= 0 && offset <= text.length
    && !(offset > 0 && offset < text.length && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset]));
}
export function emptyReading(text) { return { version: 1, source: documentVersion(text), cursor: 0, marks: [] }; }
export function parseReading(raw, text) {
  if (raw === null) return emptyReading(text);
  const value = JSON.parse(raw);
  if (value?.version !== 1 || value.source !== documentVersion(text) || !validOffset(text, value.cursor) || !Array.isArray(value.marks) || value.marks.length > 200) throw new Error('INVALID_READING');
  const ids = new Set(), positions = new Set();
  const marks = value.marks.map(mark => {
    if (typeof mark?.id !== 'string' || !mark.id || mark.id.length > 100 || ids.has(mark.id) || positions.has(mark.offset)
      || !validOffset(text, mark.offset) || !Number.isSafeInteger(mark.createdAt) || !Number.isSafeInteger(mark.updatedAt) || mark.createdAt < 0 || mark.updatedAt < mark.createdAt) throw new Error('INVALID_READING');
    ids.add(mark.id); positions.add(mark.offset);
    return { id: mark.id, offset: mark.offset, createdAt: mark.createdAt, updatedAt: mark.updatedAt };
  });
  return { version: 1, source: value.source, cursor: value.cursor, marks };
}
export function placeMark(reading, text, offset, id, now = Date.now()) {
  if (!validOffset(text, offset)) throw new Error('本文の文字を選び直してください。');
  if (reading.marks.some(mark => mark.offset === offset && mark.id !== id)) throw new Error('この位置にはすでにしおりがあります。別の文字を選んでください。');
  const old = reading.marks.find(mark => mark.id === id);
  if (!old && reading.marks.length >= 200) throw new Error('しおりが多いため、不要なしおりを外してから追加してください。');
  const mark = { id, offset, createdAt: old?.createdAt ?? now, updatedAt: Math.max(now, old?.updatedAt ?? now) };
  return { ...reading, marks: [...reading.marks.filter(item => item.id !== id), mark] };
}
export function removeMark(reading, id) { return { ...reading, marks: reading.marks.filter(mark => mark.id !== id) }; }
export function chapterStart(text, offset) {
  let cursor = 0, start = 0;
  for (const line of text.slice(0, offset).split('\n')) {
    if (/^(第[一二三四五六七八九十百千\d]+[章部節]|[一二三四五六七八九十百\d]+[．、.]?)$/.test(line.trim())) start = cursor;
    cursor += line.length + 1;
  }
  return start;
}
export function summaryRange(text, marks, id, scope) {
  const target = marks.find(mark => mark.id === id);
  if (!target || !validOffset(text, target.offset) || !['previous', 'chapter', 'start'].includes(scope)) throw new Error('しおりを選び直してください。');
  const previous = marks.filter(mark => mark.offset < target.offset).reduce((end, mark) => Math.max(end, mark.offset), 0);
  const start = scope === 'previous' ? previous : scope === 'chapter' ? chapterStart(text, target.offset) : 0;
  // 同じ段落の後半も含めず、しおりの直前で必ず止める。
  return { start, end: target.offset, text: text.slice(start, target.offset) };
}
export function readingPages(text, size = 900) {
  if (!Number.isInteger(size) || size < 2) throw new Error('INVALID_PAGE_SIZE');
  const pages = []; let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const split = text.lastIndexOf('\n', end);
      if (split > start + size / 2) end = split + 1;
      if (!validOffset(text, end)) end--;
    }
    pages.push({ start, end, text: text.slice(start, end) }); start = end;
  }
  return pages.length ? pages : [{ start: 0, end: 0, text: '' }];
}
export function pageAt(pages, offset) { return Math.max(0, pages.findIndex((page, index) => offset < page.end || index === pages.length - 1)); }
// しおりは最後に読んだ文字の「後ろ」にある。境界では次頁でなく、その文字の頁へ戻す。
export function bookmarkPage(pages, offset) { return pageAt(pages, Math.max(0, offset - 1)); }

// 保存完了までは画面の状態を確定しない。失敗しても直前の記録を保持する。
export function createReadingStore(storage, key, text) {
  let state, queue = Promise.resolve();
  return {
    async load() { state = parseReading(await storage.getItem(key), text); return state; },
    save(change) {
      const task = queue.then(async () => {
        if (!state) throw new Error('NOT_READY');
        const next = parseReading(JSON.stringify(change(state)), text);
        await storage.setItem(key, JSON.stringify(next)); state = next; return state;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
