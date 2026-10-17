import test from 'node:test';
import assert from 'node:assert/strict';
import { measuredPages, measuredPagesAsync } from '../src/features/reader/pagination.mjs';

test('分割計測は全文と絵文字の文字境界を保ち、同期版と同じページになる', async () => {
  const text = '本文😀\n'.repeat(20000), pageOf = offset => Math.floor(offset / 600);
  let yields = 0;
  const actual = await measuredPagesAsync(text, pageOf, { yieldControl: async () => { yields++; } });
  assert.deepEqual(actual, measuredPages(text, pageOf));
  assert.ok(yields > 1);
  assert.equal(actual.at(-1), text.length);
  for (const start of actual.slice(0, -1)) assert.ok(!/[\uDC00-\uDFFF]/.test(text[start]));
});

test('設定変更・画面を閉じた場合は古い計測を途中で中止する', async () => {
  let cancelled = false, calls = 0;
  const result = await measuredPagesAsync('本'.repeat(100000), offset => { calls++; return Math.floor(offset / 100); }, {
    yieldControl: async () => { cancelled = true; }, shouldCancel: () => cancelled,
  });
  assert.equal(result, null);
  assert.ok(calls < 1000);
});
