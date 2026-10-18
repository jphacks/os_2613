import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideScrollLeft, visibleScrollPage, guideOpacity, guideFramePosition, guideRowWave } from '../src/features/reader/scroll-position.mjs';

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
  assert.equal(guideScrollLeft(0, 1000, 400, 1000, 4000), -150);
  // 途中までスクロール済みでも、同じ文字に対する到達位置は変わらない。
  assert.equal(guideScrollLeft(-150, 1000, 550, 1000, 4000), -150);
  assert.equal(guideScrollLeft(-900, 1000, 800, 1000, 4000), -650);
  assert.equal(guideScrollLeft(-3000, 1000, 100, 1000, 4000), -3000);
  assert.equal(guideScrollLeft(0, 1000, 200, 1000, 1000), 0);
});


test('ガイド中は隣のページから入る文字も薄くし、強調点だけ濃く表示する', () => {
  assert.equal(guideOpacity(0, 0, false), .5);
  assert.equal(guideOpacity(20, 0, false), .5);
  assert.equal(guideOpacity(10, 10), 1);
  assert.equal(guideOpacity(100, 10), .5);
});
test('スクロールが進んだ後の波の中心は画面の右から45%の位置になる', () => {
  const target = guideScrollLeft(0, 1000, 400, 1000, 4000);
  assert.equal(400 - target, 550);
});


test('右から45%に達するまでは動かず、列幅で追従位置がずれない', () => {
  assert.equal(guideScrollLeft(0, 1000, 700, 1000, 4000), 0);
  assert.equal(guideScrollLeft(0, 1000, 550, 1000, 4000), 0);
  assert.equal(400 - guideScrollLeft(0, 1000, 400, 1000, 4000, 40), 550);
  assert.equal(400 - guideScrollLeft(0, 1000, 400, 1000, 4000, 60), 550);
});

test('文字送り時間に対して横移動が一定の割合で進み、文字サイズや行間による距離に比例する', () => {
  for (const distance of [20, 40, 72]) {
    assert.equal(guideFramePosition(0, -distance, 50, 200), -distance / 4);
    assert.equal(guideFramePosition(0, -distance, 100, 200), -distance / 2);
    assert.equal(guideFramePosition(0, -distance, 300, 200), -distance);
  }
});

test('行が範囲に入ったら上から下まで流し、広い空白では次の行へ飛ばない', () => {
  const rows = [{ distance: 100, indices: [0, 1, 2, 3] }, { distance: 220, indices: [8, 9] }];
  assert.deepEqual(guideRowWave(rows, 80, 40), { index: 0, first: 0, last: 3 });
  assert.equal(guideRowWave(rows, 100, 40).index, 2);
  assert.equal(guideRowWave(rows, 119, 40).index, 3);
  assert.equal(guideRowWave(rows, 160, 40), null);
  assert.equal(guideRowWave(rows, 200, 40).index, 8);
  assert.equal(guideRowWave(rows, 239, 40).index, 9);
});
