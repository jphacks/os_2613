import test from 'node:test';
import assert from 'node:assert/strict';
import { mathematicalIllustration } from '../src/features/study/math-illustrations.mjs';
import { curveValue } from '../src/features/study/visuals.mjs';

test('はさみうちの説明図は全区間で大小関係を保ち、3本が同じ極限0に近づく', () => {
  const visual = mathematicalIllustration({ title: 'はさみうちの原理のイメージ', after: '対応する本文' });
  const [lower, middle, upper] = visual.graph.curves;
  for (let i = -1000; i <= 1000; i++) {
    const x = i / 1000;
    assert.ok(curveValue(lower, x) <= curveValue(middle, x));
    assert.ok(curveValue(middle, x) <= curveValue(upper, x));
  }
  for (const curve of [lower, middle, upper]) {
    assert.equal(curveValue(curve, 0), 0);
    assert.ok(Math.abs(curveValue(curve, -1e-6)) < 1e-6);
    assert.ok(Math.abs(curveValue(curve, 1e-6)) < 1e-6);
  }
  assert.equal(visual.kind, 'graph'); assert.ok(!visual.imageUrl);
  assert.equal(visual.after, '対応する本文'); assert.match(visual.caption, /説明用の具体例/);
});
test('二乗の極限は計算グラフにし、数学以外の挿絵には適用しない', () => {
  const visual = mathematicalIllustration({ title: '極限のイメージ', scene: 'f(x) = x²' });
  assert.equal(curveValue(visual.graph.curves[0], 0), 0);
  assert.equal(curveValue(visual.graph.curves[0], -1), 1);
  assert.equal(mathematicalIllustration({ title: '自転車の名称ラベル', scene: 'タイヤとペダル' }), null);
});
