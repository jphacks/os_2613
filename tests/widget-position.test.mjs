import { test } from 'node:test';
import assert from 'node:assert/strict';
import { widgetPosition } from '../src/features/widget/position.mjs';
import { pageAtOffset } from '../src/features/reader/pagination.mjs';
import { bookmarkPage, readingPages } from '../src/features/bookmark/model.mjs';

test('ウィジェットのページ先頭位置を1文字戻さず、指定したページを開く', () => {
  const text = 'あ'.repeat(300);
  const starts = [0, 100, 200, 300];
  for (const offset of [0, 100, 200, 300]) {
    assert.equal(widgetPosition(text, String(offset)), offset);
    assert.equal(pageAtOffset(starts, widgetPosition(text, String(offset))), pageAtOffset(starts, offset));
  }
  assert.equal(pageAtOffset(starts, widgetPosition(text, '100')), 1);
});

test('文字サイズや画面幅が変わっても、同じ文字位置を含むページを選ぶ', () => {
  const offset = widgetPosition('本文'.repeat(300), '200');
  assert.equal(pageAtOffset([0, 100, 200, 400, 600], offset), 2);
  assert.equal(pageAtOffset([0, 150, 300, 450, 600], offset), 1);
});

test('絵文字の直後の位置を維持し、不正な位置や複数の指定は拒否する', () => {
  assert.equal(widgetPosition('a😀b', '3'), 3);
  for (const value of ['2', '-1', '1.5', '5', '', 'NaN', ['3'], undefined]) assert.equal(widgetPosition('a😀b', value), undefined);
});

test('手動しおりの文字末尾を開く既存の処理は維持する', () => {
  const pages = readingPages('あ'.repeat(1000));
  assert.equal(bookmarkPage(pages, pages[0].end), 0);
});
