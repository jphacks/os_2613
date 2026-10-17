import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanVisuals, curveFormula, curveValue, graphData } from '../src/features/study/visuals.mjs';
import { validChart } from '../src/features/study/visuals.mjs';

test('折れ線と棒グラフは全項目の数値を検証し、欠落や不正値を描かない', () => {
  const chart = { type: 'bar', basis: 'example', xLabel: '項目', yLabel: '値', labels: ['項目1', '項目2', '項目3'], series: [{ name: '方法A', values: [60, 40, 70] }, { name: '方法B', values: [80, 30, 50] }] };
  assert.equal(validChart(chart), true); assert.equal(validChart({ ...chart, type: 'line' }), true);
  for (const bad of [{ ...chart, basis: 'invented-real-data' }, { ...chart, series: [{ name: '欠落', values: [60] }] }, { ...chart, series: [{ name: '不正', values: [NaN, 40, 70] }] }]) assert.equal(validChart(bad), false);
});
const graph = { xMin: -2, xMax: 3, curves: [{ fn: 'quadratic', a: 1, b: 0, c: 0, label: 'y = x²' }, { fn: 'linear', a: 2, b: -1, c: 0, label: 'y = 2x − 1' }] };
const visual = { kind: 'graph', title: '微分と接線', caption: '点 (1,1) で傾き2の接線が接します。', after: '微分の意味を考えます。', graph, terms: [], nodes: [] };

test('比較概念図は複数の説明を保ち、不完全な説明図を表示しない', () => {
  const comparison = { ...visual, kind: 'comparison', graph: null, nodes: [
    { label: '左から近づく', detail: 'xが小さい側から近づく極限。' },
    { label: '右から近づく', detail: 'xが大きい側から近づく極限。' },
  ] };
  assert.deepEqual(cleanVisuals([comparison], visual.after), [comparison]);
  assert.deepEqual(cleanVisuals([{ ...comparison, nodes: comparison.nodes.slice(0, 1) }], visual.after), []);
  assert.deepEqual(cleanVisuals([{ ...comparison, nodes: [{ label: '左' }, { label: '右' }] }], visual.after), []);
});
test('グラフは係数から計算し、曲線と接線が(1,1)で一致する', () => {
  assert.equal(curveValue(graph.curves[0], 1), 1); assert.equal(curveValue(graph.curves[1], 1), 1);
  assert.equal(curveValue(graph.curves[0], 2), 4); assert.equal(curveValue(graph.curves[1], 2), 3);
  const data = graphData(graph); assert.equal(data.curves.length, 2); assert.ok(data.max > 9 && data.min < -1);
  assert.equal(curveFormula(graph.curves[0]), 'y = x^{2}');
  assert.equal(curveFormula(graph.curves[1]), 'y = 2 x - 1');
  assert.equal(curveFormula({ fn: 'exponential', a: 1, b: -1, c: 2 }), 'y = e^{-x} + 2');
});
test('対数の定義域外を描かず、任意コードや過大な係数・範囲を受け付けない', () => {
  assert.equal(curveValue({ fn: 'logarithm', a: 1, b: 0, c: 0 }, -1), null);
  assert.equal(curveValue({ fn: 'exponential', a: 1, b: 100, c: 0 }, 20), null);
  for (const bad of [{ ...graph, xMin: 3 }, { ...graph, xMax: 1000 }, { ...graph, curves: [{ ...graph.curves[0], fn: 'eval(x)' }] }, { ...graph, curves: [{ ...graph.curves[0], a: Infinity }] }]) {
    assert.deepEqual(cleanVisuals([{ ...visual, graph: bad }], visual.after), []);
  }
});
test('図解の挿入位置は対応する本文内だけで、色は固定の意味役割に限定する', () => {
  assert.equal(cleanVisuals([visual], visual.after).length, 1);
  const supplement = cleanVisuals([visual], 'この範囲の本文です。');
  assert.equal(supplement[0].after, 'この範囲の本文です。'); assert.equal(supplement[0].supplement, true);
  assert.deepEqual(cleanVisuals([{ ...visual, after: '' }], visual.after), []);
  assert.deepEqual(cleanVisuals([{ ...visual, kind: 'formula', terms: [{ text: 'x', meaning: '変数', role: 'javascript' }] }], visual.after), []);
  assert.equal(cleanVisuals([{ ...visual, kind: 'formula', terms: [{ text: 'x', meaning: '変数', role: 'input' }] }], visual.after).length, 1);
});
