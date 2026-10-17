import katex from 'katex';

// Presentation only: source ranges always refer to the original saved text.
export function normalizeMath(source) {
  // Older PDF extraction represented the limit-value letter ell as a backtick.
  // Restrict this repair to limit notation; never reinterpret arbitrary quotes.
  if (/\\lim(?![a-zA-Z])|\blim(?![a-zA-Z])/.test(source)) source = source.replace(/`/g, '\\ell ');
  return source.replace(/([_^])\(([^()\n]{1,120})\)/g, '$1{$2}').replace(/([_^])([+-]?\d+(?:\.\d+)?)/g, '$1{$2}')
    .replace(/([_^])([+-][a-zA-Zα-ωΑ-Ω])/g, '$1{$2}');
}
export function studyNotation(text) {
  return /極限|lim|→|\\to\b/.test(text) && !text.includes('```') ? text.replace(/`/g, 'ℓ') : text;
}
export function mathMarkup(source, display = false) {
  if (typeof source !== 'string' || source.length > 2000) return null;
  if (/\\(?:href|url|includegraphics|html\w*)\b/.test(source)) return null;
  try {
    return katex.renderToString(normalizeMath(source), { output: 'mathml', displayMode: display, throwOnError: true,
      strict: 'ignore', trust: false, maxExpand: 100, maxSize: 6, macros: {} });
  } catch { return null; }
}
const powers = /(?:\\[a-zA-Z]+|\([^()\n]{1,120}\)|\d+(?:\.\d+)?|[a-zA-Zα-ωΑ-Ω][a-zA-Z0-9]*)(?:[_^](?:\{[^{}\n]{1,120}\}|\([^()\n]{1,120}\)|[+-]?\d+(?:\.\d+)?|[+-]?[a-zA-Zα-ωΑ-Ω]))+/g;
// Saved lessons created before TeX delimiters were required often contain
// equations inline in Japanese prose (for example, "関数 f(x)=x^2 とする").
// Extract only Latin/math notation runs, then accept them when they contain an
// equation/relation operator and no ordinary English words. Japanese text is
// therefore a natural boundary, and prose such as "A/B" is left untouched.
const relationRuns = /[A-Za-zα-ωΑ-Ωℓ∞∅ℝℕℤℚℂ0-9\\{}()[\].,+\-*/=<>≤≥≈≠∈∉⊂⊆∪∩→←↔×÷±∑∫√|!_^\s]{2,240}/gu;
const mathWords = new Set(['lim', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'sup', 'inf', 'max', 'min', 'arg', 'det', 'dim', 'ker', 'Re', 'Im', 'Pr']);
function isInlineRelation(value) {
  const hasRelation = /[=<>≤≥≈≠∈∉⊂⊆→←↔]/.test(value);
  const hasArithmetic = /[+*×÷]/.test(value) || /[a-zα-ω0-9]\s*\/\s*[a-zα-ω0-9]/.test(value);
  if ((!hasRelation && !hasArithmetic) || !/[A-Za-zα-ωΑ-Ωℓ0-9]/.test(value)) return false;
  const words = value.match(/[A-Za-z]+/g) ?? [];
  return words.every(word => word.length === 1 || mathWords.has(word));
}
export function mathSegments(text, formula = false) {
  const result = []; let cursor = 0;
  const add = (raw, begin, tex, display) => {
    const markup = mathMarkup(tex, display);
    if (markup) result.push({ start: begin, end: begin + raw.length, raw, tex, markup, display });
  };
  function plain(from, to) {
    const value = text.slice(from, to);
    // A formula card or an isolated equation can be typeset as one expression.
    const isolated = !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value) && /[=＝^_]|\\(?:frac|sum|sqrt|int|exp|log|sin|cos)\b/.test(value);
    if ((formula || isolated) && value.trim() && !value.includes('$')) {
      const markup = mathMarkup(value, false);
      if (markup) { add(value, from, value, false); return; }
    }
    const recognized = [];
    for (const match of value.matchAll(relationRuns)) {
      const raw = match[0], trimmed = raw.trim();
      if (!isInlineRelation(trimmed)) continue;
      const leading = raw.length - raw.trimStart().length;
      const trailingPunctuation = trimmed.match(/[.,;:!?]+$/)?.[0] ?? '';
      const expression = trimmed.slice(0, trimmed.length - trailingPunctuation.length).trimEnd();
      if (!expression || !isInlineRelation(expression)) continue;
      const start = from + match.index + leading;
      const end = start + expression.length;
      if (mathMarkup(expression)) recognized.push({ start, end });
    }
    // Prefer the complete relation (e.g. f(x)=x^2) over the smaller power
    // expression it contains. The original text and its offsets stay intact.
    for (const range of recognized) add(text.slice(range.start, range.end), range.start, text.slice(range.start, range.end), false);
    for (const match of value.matchAll(powers)) {
      const start = from + match.index, end = start + match[0].length;
      if (recognized.some(range => start >= range.start && end <= range.end)) continue;
      add(match[0], start, match[0], false);
    }
  }
  const delimited = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?:\\.|[^$\\\n])+\$/g;
  for (const match of text.matchAll(delimited)) {
    plain(cursor, match.index);
    const raw = match[0], double = raw.startsWith('$$') || raw.startsWith('\\['), edge = raw.startsWith('$') && !raw.startsWith('$$') ? 1 : 2;
    add(raw, match.index, raw.slice(edge, -edge), double);
    cursor = match.index + raw.length;
  }
  plain(cursor, text.length);
  return result.sort((a, b) => a.start - b.start);
}
