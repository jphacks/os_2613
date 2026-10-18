import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetHeights, sheetDestination } from '../src/shared/reader-sheet.mjs';
test('シートは本文を残す半開きと全開の2段階で、上スワイプは拡大する', () => {
  const { compact, full } = sheetHeights(800);
  assert.ok(Math.abs(compact / 800 - .50) < .001); assert.ok(Math.abs(full / 800 - .70) < .001);
  assert.equal(sheetDestination(compact, -160, -.1, 800), full);
  assert.equal(sheetDestination(full, 120, .1, 800), compact);
});
test('短い揺れでは閉じず、十分な下スワイプか速いフリックで閉じる', () => {
  const { compact } = sheetHeights(800);
  assert.equal(sheetDestination(compact, 10, .01, 800), compact);
  assert.equal(sheetDestination(compact, 240, .1, 800), 0);
  assert.equal(sheetDestination(compact, 80, .9, 800), 0);
});
test('小さな画面でもシートの高さを無効にしない', () => {
  const { compact, full } = sheetHeights(240);
  assert.ok(compact > 0 && compact <= full && full < 240);
});
