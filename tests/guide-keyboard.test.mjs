import test from 'node:test';
import assert from 'node:assert/strict';
import { bindGuideKeyboard } from '../src/features/reader/guide-keyboard.mjs';
test('Spaceは再生を切り替え、入力中・長押し・修飾キー・既処理のイベントを無視する', () => {
  let handler, toggles = 0;
  const cleanup = bindGuideKeyboard({ addEventListener: (_, fn) => { handler = fn; }, removeEventListener: (_, fn) => assert.equal(fn, handler) }, () => () => toggles++);
  const event = extra => ({ code: 'Space', target: { closest: () => null }, preventDefault() { this.defaultPrevented = true; }, ...extra });
  const e = event(); handler(e); assert.equal(toggles, 1); assert.equal(e.defaultPrevented, true); handler(e); assert.equal(toggles, 1);
  for (const extra of [{ repeat: true }, { ctrlKey: true }, { isComposing: true }, { target: { closest: () => ({}) } }]) handler(event(extra));
  assert.equal(toggles, 1); cleanup();
});
