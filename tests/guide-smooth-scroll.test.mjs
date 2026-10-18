import test from 'node:test';
import assert from 'node:assert/strict';
import { smoothGuideScroll } from '../src/features/reader/scroll-position.mjs';

test('追従は目標へ近づき、逆方向の目標でも通り越さない', () => {
  for (const [current, target] of [[0, -400], [-400, -100]]) {
    const next = smoothGuideScroll(current, target, 16);
    assert.ok(next > Math.min(current, target) && next < Math.max(current, target));
  }
});
test('同じ経過時間ならフレームレートに依存せず追従する', () => {
  let high = 0, low = 0;
  for (let i = 0; i < 60; i++) high = smoothGuideScroll(high, -400, 1000 / 60);
  for (let i = 0; i < 30; i++) low = smoothGuideScroll(low, -400, 1000 / 30);
  assert.ok(Math.abs(high - low) < .00001);
});
test('時間が進まなければ動かず、目標更新後も現在位置から動く', () => {
  assert.equal(smoothGuideScroll(-20, -400, 0), -20);
  const first = smoothGuideScroll(0, -100, 16);
  const next = smoothGuideScroll(first, -200, 16);
  assert.ok(next < first && next > -200);
});
