const short = (value, length) => typeof value === 'string' && value.length <= length;
export function cleanVisuals(value, text) {
  if (!Array.isArray(value)) return undefined;
  const lastLine = text.split('\n').filter(line => line.trim()).at(-1) ?? '';
  return value.slice(0, 8).map(item => item && short(item.after, 160) && item.after.trim() && !text.includes(item.after) && lastLine
    ? { ...item, after: lastLine.slice(-160), supplement: true } : item).filter(item => {
    if (!item || !['graph', 'flow', 'comparison', 'formula'].includes(item.kind) || !short(item.title, 100) || !short(item.caption, 500)
      || !short(item.after, 160) || !item.after.trim() || !text.includes(item.after)) return false;
    if (item.kind === 'formula') return Array.isArray(item.terms) && item.terms.length > 0 && item.terms.length <= 12
      && item.terms.every(term => short(term.text, 120) && short(term.meaning, 160) && ['input', 'operation', 'result', 'plain'].includes(term.role));
    if (item.kind === 'flow' || item.kind === 'comparison') return Array.isArray(item.nodes) && item.nodes.length >= 2 && item.nodes.length <= 6
      && item.nodes.every(node => short(node.label, 80) && short(node.detail, 200));
    const graph = item.graph;
    return graph && Number.isFinite(graph.xMin) && Number.isFinite(graph.xMax) && graph.xMin >= -20 && graph.xMax <= 20 && graph.xMax > graph.xMin
      && Array.isArray(graph.curves) && graph.curves.length >= 1 && graph.curves.length <= 3
      && graph.curves.every(curve => ['quadratic', 'linear', 'exponential', 'sine', 'logarithm'].includes(curve.fn)
        && short(curve.label, 100) && [curve.a, curve.b, curve.c].every(n => Number.isFinite(n) && Math.abs(n) <= 100));
  });
}
export function curveValue(curve, x) {
  const { a, b, c } = curve;
  const y = curve.fn === 'quadratic' ? a * x * x + b * x + c : curve.fn === 'linear' ? a * x + b
    : curve.fn === 'exponential' ? a * Math.exp(b * x) + c : curve.fn === 'sine' ? a * Math.sin(b * x) + c
      : x > 0 ? a * Math.log(x) + c : NaN;
  return Number.isFinite(y) && Math.abs(y) <= 10000 ? y : null;
}
export function curveFormula(curve) {
  const number = value => String(value);
  const signed = value => value < 0 ? ` - ${number(-value)}` : value > 0 ? ` + ${number(value)}` : '';
  const scaled = (factor, value) => factor === 1 ? value : factor === -1 ? `-${value}` : `${number(factor)} ${value}`;
  const { a, b, c } = curve;
  if (curve.fn === 'linear') return `y = ${scaled(a, 'x')}${signed(b)}`;
  if (curve.fn === 'quadratic') return `y = ${scaled(a, 'x^{2}')}${b ? `${b < 0 ? ' - ' : ' + '}${scaled(Math.abs(b), 'x')}` : ''}${signed(c)}`;
  if (curve.fn === 'logarithm') return `y = ${scaled(a, '\\ln(x)')}${signed(c)}`;
  const argument = scaled(b, 'x');
  const base = curve.fn === 'exponential' ? `e^{${argument}}` : `\\sin(${argument})`;
  return `y = ${scaled(a, base)}${signed(c)}`;
}
export function graphData(graph) {
  const curves = graph.curves.map(curve => ({ label: curve.label, points: Array.from({ length: 201 }, (_, i) => {
    const x = graph.xMin + (graph.xMax - graph.xMin) * i / 200;
    return { x, y: curveValue(curve, x) };
  }) }));
  const ys = curves.flatMap(curve => curve.points.map(p => p.y).filter(y => y !== null));
  if (!ys.length) return null;
  let min = Math.min(0, ...ys), max = Math.max(0, ...ys);
  if (max - min < 0.001) { min--; max++; }
  const pad = (max - min) * 0.08;
  return { curves, min: min - pad, max: max + pad };
}
