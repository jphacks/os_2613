import test from 'node:test';
import assert from 'node:assert/strict';
import { studyLines } from '../src/features/study/format.mjs';

test('教材のタイトル・見出し・要点・用語に表示上の強調を付ける', () => {
  const lines = studyLines('指数関数を学ぶ\n【説明】\n「指数関数」を考えます。\n【ポイント】\n定義には条件があります。例を確かめます。');
  assert.equal(lines[0].title, true); assert.equal(lines[1].heading, true);
  assert.equal(lines[2].heading, false); assert.deepEqual(lines[2].emphasis[0], [0, 6]);
  assert.equal(lines[4].important, true);
  assert.equal(lines[4].text.slice(...lines[4].emphasis[0]), '定義には条件があります。');
});
test('横書き用の装飾でも本文・改行・UTF16のしおり位置を変更しない', () => {
  const text = '😀教材\n\n【学習目標】\n関数を理解する。\n';
  const lines = studyLines(text);
  assert.equal(lines.map(line => line.text).join('\n'), text);
  for (const line of lines) assert.equal(text.slice(line.start, line.start + line.text.length), line.text);
  assert.equal(lines[1].start, 5);
});

test('覚える公式を囲み、途中式・導出や具体例の式は囲まない', () => {
  const lines = studyLines('教材\n【公式】\ny = x^2\n= x × x\n【公式の導出】\ny = x × x\n【具体例】\ny = 4');
  assert.equal(lines[2].callout, 'formula');
  for (const i of [3, 5, 7]) assert.equal(lines[i].callout, null);
});
test('定義と要点の最初の説明を囲み、補足説明まで一律に囲まない', () => {
  const lines = studyLines('教材\n【定義】\n「関数」とは対応の規則です。\n補足の説明です。\n【要点】\n条件を確認しましょう。\n別の補足です。');
  assert.equal(lines[2].callout, 'definition'); assert.equal(lines[3].callout, null);
  assert.equal(lines[5].callout, 'keypoint'); assert.equal(lines[6].callout, null);
});
