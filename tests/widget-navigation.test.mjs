import { test } from 'node:test';
import assert from 'node:assert/strict';
import { widgetEntryOptions } from '../src/features/widget/navigation.mjs';

test('ウィジェットのしおりリンクでは、画面を直接切り替える', () => {
  for (const mark of ['0', '246', '12000']) assert.deepEqual(widgetEntryOptions({ id: 'aozora-1567', mark }), { animation: 'none' });
});

test('本棚・通常の本や教材・認証などのパラメータでは通常の遷移を維持する', () => {
  for (const params of [undefined, null, {}, { id: 'calculus' }, { id: 'aozora-1567' }, { state: 'test' }, { mark: '' }, { mark: '-1' }, { mark: '1.5' }, { mark: ['246'] }, { mark: '9999999999999999999999' }]) {
    assert.deepEqual(widgetEntryOptions(params), {});
  }
});
