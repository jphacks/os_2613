import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideScrollLeft, visibleScrollPage } from '../src/features/reader/scroll-position.mjs';

test('ページ途中では表示面積の多いページを選び、RTLの端の跳ね返りも範囲内に収める', () => {
  assert.equal(visibleScrollPage(-190, 400, 10), 0);
  assert.equal(visibleScrollPage(-210, 400, 10), 1);
  assert.equal(visibleScrollPage(-1250, 400, 10), 3);
  assert.equal(visibleScrollPage(70, 400, 10), 0);
  assert.equal(visibleScrollPage(-4100, 400, 10), 9);
  assert.equal(visibleScrollPage(-200, 0, 10), 0);
  assert.equal(visibleScrollPage(-300, 400, 1), 0);
});

test('ガイドは強調中の列に追従し、ページ境界を越えても同じ列の位置を保つ', () => {
  assert.equal(guideScrollLeft(0, 1000, 950, 1000, 4000), 0);
  assert.equal(guideScrollLeft(0, 1000, 400, 1000, 4000), -250);
  // 途中までスクロール済みでも、同じ文字に対する到達位置は変わらない。
  assert.equal(guideScrollLeft(-150, 1000, 550, 1000, 4000), -250);
  assert.equal(guideScrollLeft(-900, 1000, 800, 1000, 4000), -750);
  assert.equal(guideScrollLeft(-3000, 1000, 100, 1000, 4000), -3000);
  assert.equal(guideScrollLeft(0, 1000, 200, 1000, 1000), 0);
});
