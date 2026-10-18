import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reachedEnding } from '../src/features/reader/ending.mjs';
test('最終本文ページや途中のスワイプでは読了にせず、その次の終了ページで判定する', () => {
  assert.equal(reachedEnding(-9 * 400, 400, 10), false);
  assert.equal(reachedEnding(-9.5 * 400, 400, 10), false);
  assert.equal(reachedEnding(-10 * 400, 400, 10), true);
  assert.equal(reachedEnding(0, 400, 1), false);
  assert.equal(reachedEnding(-400, 400, 1), true);
});
test('画面が計測されていない時や無効なページ数で読了にしない', () => {
  for (const args of [[0, 0, 1], [-400, 400, 0], [-Infinity, 400, 1], [-400, NaN, 1]]) assert.equal(reachedEnding(...args), false);
});
