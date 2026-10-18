import test from 'node:test';
import assert from 'node:assert/strict';
import { mathMarkup, mathSegments, normalizeMath, studyNotation } from '../src/features/study/math.mjs';
import { studyLines } from '../src/features/study/format.mjs';

test('保存済みの極限値の抽出記号をellとして表示し、添字を保つ', () => {
  const source = '\\lim_{y \\to `} g(y) = `_0';
  assert.equal(normalizeMath(source), '\\lim_{y \\to \\ell } g(y) = \\ell _{0}');
  const markup = mathMarkup(source);
  assert.match(markup, /<msub>/); assert.ok(!markup.includes('`'));
  assert.equal(studyNotation('極限が`であり、結果が`_0となる。'), '極限がℓであり、結果がℓ_0となる。');
  assert.equal(studyNotation('コード `x` の説明'), 'コード `x` の説明');
  assert.equal(studyNotation('極限のコード ```x```'), '極限のコード ```x```');
});

test('乗数・添字と複数桁の指数を正しいMathML構造で描く', () => {
  assert.match(mathMarkup('x^2'), /<msup>/);
  assert.match(mathMarkup('x_12'), /<msub>/);
  assert.equal(normalizeMath('x^12 + e^(n+1) + a_-2'), 'x^{12} + e^{n+1} + a_{-2}');
  assert.match(mathMarkup('x^12'), /<mn>12<\/mn>/);
  assert.match(mathMarkup('e^(n+1)'), /<msup>/);
  assert.match(mathMarkup('e^-x'), /<msup>/);
});
test('分数・総和・平方根をテキストの記号でなく数式として描く', () => {
  assert.match(mathMarkup(String.raw`\frac{x^2}{n!}`), /<mfrac>/);
  assert.match(mathMarkup(String.raw`\sum_{n=0}^{\infty} \frac{x^n}{n!}`, true), /<munderover>/);
  assert.match(mathMarkup(String.raw`\sqrt{x}`), /<msqrt>/);
});
test('保存済み本文の式だけ変換し、元の文字列とUTF16の位置を残す', () => {
  const text = String.raw`😀 x^2 を考える。式は \(\frac{1}{2}\) です。`;
  const parts = mathSegments(text);
  assert.equal(parts.length, 2);
  for (const part of parts) assert.equal(text.slice(part.start, part.end), part.raw);
  assert.equal(parts[0].start, 3); assert.match(parts[0].markup, /<msup>/);
  assert.match(parts[1].markup, /<mfrac>/);
  assert.equal(mathSegments('例は2^3と(x+1)^2です。').length, 2);
});
test('数式区切りのない保存済み要約でも文章内の関係式を数式表示する', () => {
  const text = '関数 f(x)=x^2 とする。確率 P(X=x)=p_x である。極限 lim_{x→a} f(x)=ℓ を考える。';
  const parts = mathSegments(text);
  assert.deepEqual(parts.map(part => part.raw), ['f(x)=x^2', 'P(X=x)=p_x', 'lim_{x→a} f(x)=ℓ']);
  assert.match(parts[0].markup, /<msup>/);
  assert.match(parts[1].markup, /<msub>/);
  assert.match(parts[2].markup, /<mo>→<\/mo>/);
  for (const part of parts) assert.equal(text.slice(part.start, part.end), part.raw);
  assert.equal(mathSegments('対象A/Bの比較や、表記x^2を確認する。').some(part => part.raw === 'A/B'), false);
  assert.equal(mathSegments('分数1/2を計算する。')[0].raw, '1/2');
});
test('複数行の数式をまとめても本文・改行・しおり位置を変えない', () => {
  const text = String.raw`説明です。
\[
\frac{x^2}{2}
\]
次の説明です。`;
  const lines = studyLines(text);
  assert.equal(lines.map(line => line.text).join('\n'), text);
  assert.equal(lines.length, 3); assert.match(mathSegments(lines[1].text)[0].markup, /<mfrac>/);
  assert.equal(text.slice(lines[2].start), '次の説明です。');
});
test('壊れた式・巨大な式・外部URLやHTML命令を実行しない', () => {
  assert.equal(mathMarkup(String.raw`\frac{a}{`), null);
  assert.equal(mathMarkup('x'.repeat(2001)), null);
  assert.equal(mathMarkup(String.raw`\href{javascript:alert(1)}{x}`), null);
  assert.equal(mathMarkup(String.raw`\htmlClass{evil}{x}`), null);
  assert.ok(!mathMarkup('<script>alert(1)</script>')?.includes('<script>'));
});
