import test from 'node:test';
import assert from 'node:assert/strict';
import { repairMathText, missingMathBars } from '../src/features/pdf/math-text.mjs';

const item = (str, fontName, x = 0, width = 0, y = 20) => ({ str, fontName, width, height: 10, dir: 'ltr', transform: [10, 0, 0, 10, x, y], hasEOL: false });
const fonts = { symbols: 'ABCDEF+CMSY10', digits: 'ABCDEF+CMR10', arrows: 'ABCDEF+MSBM10' };
test('普通の数字6・7・9と、位置の違う等号は置き換えない', () => {
  const content = { items: [item('679', 'digits', 0, 15), item('6', 'symbols', 30), item('=', 'digits', 50, 5)] };
  assert.deepEqual(repairMathText(content, fonts), content);
});
test('重なった記号だけを補正し、入力データを変更しない', () => {
  const content = { items: [item('} 6', 'symbols', 0, 8), item('=', 'digits', 8, 7), item('7', 'symbols', 20), item('→', 'symbols', 20, 10), item('9', 'arrows', 40, 10)] };
  const copy = structuredClone(content);
  assert.deepEqual(repairMathText(content, fonts).items.map(item => item.str), ['} ', '≠', '', '↦', '↛']);
  assert.deepEqual(content, copy);
});
test('数式フォントと判定できないページには補正を加えない', () => {
  const content = { items: [item('6', 'unknown'), item('=', 'digits'), item('9', 'unknown')] };
  assert.deepEqual(repairMathText(content, fonts), content);
});
test('同じ文字コードでも通常フォントの制御文字は絶対値として補わない', () => {
  const ops = { beginText: 1, setFont: 2, showText: 3 };
  const operators = { fnArray: [1, 2, 3], argsArray: [[], ['digits', 10], [[{ originalCharCode: 12, unicode: '\f', width: 333 }]]] };
  assert.deepEqual(missingMathBars(operators, ops, fonts), []);
});
