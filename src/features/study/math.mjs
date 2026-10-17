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
    for (const match of value.matchAll(powers)) add(match[0], from + match.index, match[0], false);
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
