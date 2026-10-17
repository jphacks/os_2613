// Mathematical curves are computed from explicit examples, never painted by an image model.
export function mathematicalIllustration(figure) {
  const description = `${figure.title}\n${figure.caption}\n${figure.scene}`;
  const common = { after: figure.after, supplement: figure.supplement, kind: 'graph', terms: [], nodes: [] };
  if (/はさみうち|挟みうち|挟み撃ち/.test(figure.title)) return { ...common,
    title: 'はさみうちの原理：3本の関数が同じ値に近づく例',
    caption: '説明用の具体例です。下側を f₁(x) = x/2 − x²、中央を f(x) = x/2、上側を f₂(x) = x/2 ＋ x² とします。x² ≥ 0 なので常に f₁(x) ≤ f(x) ≤ f₂(x)。x が左右どちらから 0 に近づいても、3本とも 0 に近づきます。この例では a = 0、ℓ = 0 です。',
    graph: { xMin: -1, xMax: 1, curves: [
      { fn: 'quadratic', a: -1, b: 0.5, c: 0, label: '下側の関数 f₁' },
      { fn: 'linear', a: 0.5, b: 0, c: 0, label: '中央の関数 f' },
      { fn: 'quadratic', a: 1, b: 0.5, c: 0, label: '上側の関数 f₂' },
    ] } };
  if (/極限/.test(figure.title) && /(?:x²|x\^2|x\^\{2\})/.test(description)) return { ...common,
    title: '関数の極限：x² が 0 に近づく例',
    caption: '説明用の具体例です。f(x) = x² を式から計算して描いています。x が左右どちらから 0 に近づいても、f(x) は 0 に近づきます。この例では a = 0、極限値は 0 です。',
    graph: { xMin: -1, xMax: 1, curves: [{ fn: 'quadratic', a: 1, b: 0, c: 0, label: '関数 f' }] } };
  return null;
}
