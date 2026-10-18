import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleScrollPage } from '../src/features/reader/scroll-position.mjs';

test('ページ途中では表示面積の多いページを選び、RTLの端の跳ね返りも範囲内に収める', () => {
  assert.equal(visibleScrollPage(-190, 400, 10), 0);
  assert.equal(visibleScrollPage(-210, 400, 10), 1);
  assert.equal(visibleScrollPage(-1250, 400, 10), 3);
  assert.equal(visibleScrollPage(70, 400, 10), 0);
  assert.equal(visibleScrollPage(-4100, 400, 10), 9);
  assert.equal(visibleScrollPage(-200, 0, 10), 0);
  assert.equal(visibleScrollPage(-300, 400, 1), 0);
});
