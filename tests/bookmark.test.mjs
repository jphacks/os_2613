import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookmarkPage, emptyReading, parseReading, placeMark, removeMark, validOffset, readingPages, pageAt, summaryRange, createReadingStore } from '../src/features/bookmark/model.mjs';

const text = '第一章\n友人が訪れた。約束をした。\n第二章\n川を渡る。未読の結末。';
test('文字しおりの直前で要約を止め、同じ段落の未読文を含めない', () => {
  const offset = text.indexOf('約束');
  const reading = placeMark(emptyReading(text), text, offset, 'first', 1);
  assert.equal(summaryRange(text, reading.marks, 'first', 'start').text, text.slice(0, offset));
  assert.ok(!summaryRange(text, reading.marks, 'first', 'start').text.includes('約束'));
  assert.ok(!summaryRange(text, reading.marks, 'first', 'start').text.includes('結末'));
});
test('前回から・章のはじめから・最初からの範囲を区別する', () => {
  const first = text.indexOf('第二章'), end = text.indexOf('未読');
  let reading = placeMark(emptyReading(text), text, first, 'a', 1);
  reading = placeMark(reading, text, end, 'b', 2);
  assert.equal(summaryRange(text, reading.marks, 'b', 'previous').text, text.slice(first, end));
  assert.equal(summaryRange(text, reading.marks, 'b', 'chapter').start, first);
  assert.equal(summaryRange(text, reading.marks, 'b', 'start').start, 0);
  assert.throws(() => summaryRange(text, reading.marks, 'missing', 'start'));
  assert.throws(() => summaryRange(text, reading.marks, 'b', 'invalid'));
});
test('移動で同じしおりIDを保ち、解除後は要約を作れない', () => {
  let reading = placeMark(emptyReading(text), text, 15, 'a', 1);
  reading = placeMark(reading, text, 8, 'a', 2);
  assert.equal(reading.marks.length, 1); assert.equal(reading.marks[0].id, 'a'); assert.equal(reading.marks[0].createdAt, 1);
  assert.equal(summaryRange(text, reading.marks, 'a', 'start').end, 8);
  reading = removeMark(reading, 'a'); assert.equal(reading.marks.length, 0);
  assert.throws(() => summaryRange(text, reading.marks, 'a', 'start'));
});
test('同じ位置の重複と文字の途中の不正な境界を拒否する', () => {
  const unicode = 'あ😀い';
  assert.equal(validOffset(unicode, 2), false);
  const reading = placeMark(emptyReading(unicode), unicode, 3, 'a', 1);
  assert.throws(() => placeMark(reading, unicode, 3, 'b', 2));
  for (const offset of [-1, 100, 2, 1.5]) assert.throws(() => placeMark(reading, unicode, offset, 'b', 2));
});
test('ページ表示はしおりを増やさず、改ページで文字を欠落させない', () => {
  const body = 'あ😀い\n'.repeat(500), pages = readingPages(body);
  assert.equal(pages.map(page => page.text).join(''), body);
  for (const page of pages) { assert.ok(validOffset(body, page.start)); assert.ok(validOffset(body, page.end)); }
  assert.equal(pageAt(pages, body.length), pages.length - 1);
  assert.equal(emptyReading(body).marks.length, 0);
  assert.throws(() => readingPages(body, 0));
});
test('頁末のしおりから戻ると次頁へ飛ばず、元の文字がある頁を開く', () => {
  const pages = readingPages('あ'.repeat(2000));
  assert.equal(bookmarkPage(pages, pages[0].end), 0);
  assert.equal(bookmarkPage(pages, pages[0].end + 1), 1);
  assert.equal(bookmarkPage(pages, 0), 0);
});
test('壊れた記録や変更された本文へ古いしおりを流用しない', () => {
  const saved = placeMark(emptyReading(text), text, 10, 'a', 1);
  assert.deepEqual(parseReading(JSON.stringify(saved), text), saved);
  for (const raw of ['{', '{}', JSON.stringify({ ...saved, cursor: -1 }), JSON.stringify({ ...saved, marks: [...saved.marks, saved.marks[0]] })]) assert.throws(() => parseReading(raw, text));
  assert.throws(() => parseReading(JSON.stringify(saved), text.replace('友人', '家族')));
});
test('保存を直列化し、保存失敗時は前のしおりを保持する', async () => {
  let raw = null, fail = false;
  const store = createReadingStore({ getItem: async () => raw, setItem: async (_, value) => { if (fail) throw new Error('容量不足'); raw = value; } }, 'book', text);
  await store.load();
  await Promise.all([store.save(state => placeMark(state, text, 5, 'a', 1)), store.save(state => placeMark(state, text, 10, 'b', 2))]);
  assert.equal(JSON.parse(raw).marks.length, 2);
  fail = true; await assert.rejects(store.save(state => removeMark(state, 'a')));
  assert.equal(JSON.parse(raw).marks.length, 2);
  fail = false; const next = await store.save(state => ({ ...state, cursor: 20 }));
  assert.equal(next.marks.length, 2);
});
test('保存先を本ごとに分離し、再読み込みでしおりを復元する', async () => {
  const data = new Map(), adapter = { getItem: async key => data.get(key) ?? null, setItem: async (key, raw) => { data.set(key, raw); } };
  const first = createReadingStore(adapter, 'book-a', text); await first.load(); await first.save(state => placeMark(state, text, 7, 'a', 1));
  assert.equal((await createReadingStore(adapter, 'book-b', text).load()).marks.length, 0);
  assert.equal((await createReadingStore(adapter, 'book-a', text).load()).marks[0].offset, 7);
});

test('しおりは99個まで追加でき、移動と削除後の追加はできる', () => {
  const body = 'あ'.repeat(110);
  let reading = emptyReading(body);
  for (let i = 0; i < 99; i++) reading = placeMark(reading, body, i, String(i), i);
  assert.throws(() => placeMark(reading, body, 100, 'extra', 100), /99個/);
  reading = placeMark(reading, body, 101, '0', 101);
  assert.equal(reading.marks.length, 99);
  reading = removeMark(reading, '1');
  reading = placeMark(reading, body, 100, 'extra', 102);
  assert.equal(reading.marks.length, 99);
});
