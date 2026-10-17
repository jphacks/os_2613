import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, defaultPreferences } from '../src/features/reader/preferences.mjs';
import { edgeTurn, horizontalTurn, pageForAnchor } from '../src/features/reader/gestures.mjs';
import { emptyReading, placeMark, parseReading, summaryRange } from '../src/features/bookmark/model.mjs';
import { measuredPages, pageAtOffset, pageFromTrack } from '../src/features/reader/pagination.mjs';

test('壊れた表示設定は項目ごとに標準へ戻し、未定義の値を紙面へ渡さない', () => {
  for (const value of [null, undefined, {}, 'invalid']) assert.deepEqual(normalizePreferences(value), defaultPreferences);
  assert.deepEqual(normalizePreferences({ fontSize: 9999, lineHeight: 0, font: 'arbitrary-css', paper: 'unknown' }), defaultPreferences);
  const valid = { fontSize: 32, lineHeight: 2.5, font: 'rounded', paper: 'dark' };
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(valid))), valid);
  assert.deepEqual(normalizePreferences({ font: 'gothic', paper: 'cream', fontSize: NaN }), { ...defaultPreferences, font: 'gothic', paper: 'cream' });
});
test('右スワイプで左の次頁、左スワイプで右の前頁に進む', () => {
  assert.equal(horizontalTurn(90, 5), 'next'); assert.equal(horizontalTurn(-90, 5), 'prev');
  assert.equal(horizontalTurn(45, 0), 'next'); assert.equal(horizontalTurn(-45, 0), 'prev');
});
test('縦の操作・短い移動・斜めの操作ではページを送らない', () => {
  for (const [dx, dy] of [[20, 0], [0, 90], [50, 70], [60, 50], [NaN, 0], [100, Infinity]]) assert.equal(horizontalTurn(dx, dy), null);
});
test('しおりは紙面端で次頁・前頁へ進め、余白の外では端送りしない', () => {
  assert.equal(edgeTurn(24, 20, 390), 'next'); assert.equal(edgeTurn(405, 20, 390), 'prev');
  for (const x of [25, 28, 30, 29]) assert.equal(edgeTurn(x, 20, 390), 'next');
  assert.equal(edgeTurn(220, 20, 390), null); assert.equal(edgeTurn(19, 20, 390), null); assert.equal(edgeTurn(411, 20, 390), null);
  assert.equal(edgeTurn(0, 0, 0), null);
});
test('文字サイズ変更でページ数が変わっても、同じ本文位置がある頁へ戻す', () => {
  const ends = [1, 2, 4, 5, 6, 7];
  const narrow = [0, 0, 1, 1, 2, 2], wide = [0, 0, 0, 0, 1, 1];
  assert.equal(pageForAnchor(ends, narrow, 4), 1);
  assert.equal(pageForAnchor(ends, wide, 4), 0);
  assert.equal(pageForAnchor(ends, narrow, 0), 0);
  assert.equal(pageForAnchor([], [], 0), 0);
});
test('表示設定だけを変えてもしおりの文字位置・要約の既読境界は変わらない', () => {
  const text = '読み終えた文章。😀未読の結末。';
  const offset = text.indexOf('未読');
  const saved = placeMark(emptyReading(text), text, offset, 'mark', 1);
  const raw = JSON.stringify(saved);
  normalizePreferences({ fontSize: 32, lineHeight: 1.5, font: 'gothic', paper: 'gray' });
  const restored = parseReading(raw, text);
  assert.equal(restored.marks[0].offset, offset);
  assert.equal(summaryRange(text, restored.marks, 'mark', 'start').text, '読み終えた文章。😀');
});

test('全文から実測したページを作り、900文字の境目でも欠落・重複を作らない', () => {
  const text = '文章。😀\n'.repeat(500);
  const offsets = Array.from(text).reduce((list, char) => [...list, list[list.length - 1] + char.length], [0]);
  const starts = measuredPages(text, offset => Math.floor(offsets.indexOf(offset) / 1500));
  assert.equal(starts[1], offsets[1500]);
  assert.ok(starts[1] > 900);
  assert.equal(starts.slice(0, -1).map((start, i) => text.slice(start, starts[i + 1])).join(''), text);
  for (const start of starts) assert.ok(!/[\uDC00-\uDFFF]/.test(text[start] ?? ''));
  assert.equal(pageAtOffset(starts, starts[1]), 1);
  assert.equal(pageAtOffset(starts, starts[1] - 1), 0);
  assert.equal(pageAtOffset(starts, text.length), starts.length - 2);
  assert.deepEqual(measuredPages('', () => 0), [0, 0]);
});

test('ページ移動バーは右端が最初、左端が最後。1ページや紙面外の操作も範囲内に収める', () => {
  assert.equal(pageFromTrack(100, 100, 11), 0);
  assert.equal(pageFromTrack(0, 100, 11), 10);
  assert.equal(pageFromTrack(50, 100, 11), 5);
  assert.equal(pageFromTrack(-10, 100, 11), 10);
  assert.equal(pageFromTrack(110, 100, 11), 0);
  assert.equal(pageFromTrack(40, 100, 1), 0);
  assert.equal(pageFromTrack(NaN, 0, 1), 0);
});
