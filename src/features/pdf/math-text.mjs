// TeXの数式フォントは数字や制御文字のコードで記号を描くことがある。
// 本文の数字を置き換えないよう、フォント名と重なり位置を両方確認する。
const identity = () => [1, 0, 0, 1, 0, 0];
function multiply(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
const family = name => (name ?? '').replace(/^[A-Z]{6}\+/, '');

export function missingMathBars(operators, ops, fonts) {
  let state = { matrix: identity(), line: identity(), ctm: identity(), font: '', size: 0, char: 0, word: 0, scale: 1, rise: 0, leading: 0 };
  const stack = [], parts = [], fractions = [];
  const move = (x, y) => { state.line = multiply(state.line, [1, 0, 0, 1, x, y]); state.matrix = [...state.line]; };
  for (let index = 0; index < operators.fnArray.length; index++) {
    const fn = operators.fnArray[index], args = operators.argsArray[index] ?? [];
    if (fn === ops.save) stack.push(structuredClone(state));
    else if (fn === ops.restore) state = stack.pop() ?? state;
    else if (fn === ops.transform) state.ctm = multiply(state.ctm, args);
    else if (fn === ops.beginText) state.matrix = state.line = identity();
    else if (fn === ops.setTextMatrix) state.matrix = state.line = [...args];
    else if (fn === ops.setFont) [state.font, state.size] = args;
    else if (fn === ops.setCharSpacing) state.char = args[0];
    else if (fn === ops.setWordSpacing) state.word = args[0];
    else if (fn === ops.setHScale) state.scale = args[0] / 100;
    else if (fn === ops.setTextRise) state.rise = args[0];
    else if (fn === ops.setLeading) state.leading = args[0];
    else if (fn === ops.moveText) move(...args);
    else if (fn === ops.setLeadingMoveText) { state.leading = -args[1]; move(...args); }
    else if (fn === ops.nextLine) move(0, -state.leading);
    else if (fn === ops.constructPath && args[2]) {
      const bounds = Array.from(args[2]);
      if (bounds.length === 4 && Math.abs(bounds[3] - bounds[1]) < 0.1 && bounds[2] - bounds[0] > 1 && bounds[2] - bounds[0] < 30 && Math.abs(state.ctm[1]) < 0.001 && Math.abs(state.ctm[2]) < 0.001) {
        const x = state.ctm[0] * bounds[0] + state.ctm[4], y = state.ctm[3] * bounds[1] + state.ctm[5];
        const size = Math.abs(state.size) || 10;
        fractions.push({ str: '⁄', dir: 'ltr', width: Math.abs(state.ctm[0] * (bounds[2] - bounds[0])), height: size, transform: [size, 0, 0, size, x, y - size / 4], fontName: state.font, hasEOL: false });
      }
    }
    else if (fn === ops.showText) {
      for (const glyph of args[0]) {
        if (typeof glyph === 'number') { state.matrix = multiply(state.matrix, [1, 0, 0, 1, -glyph / 1000 * state.size * state.scale, 0]); continue; }
        if (/^CMEX\d+$/.test(family(fonts[state.font])) && glyph.originalCharCode === 12 && glyph.unicode === '\f') {
          const transform = multiply(state.ctm, multiply(state.matrix, [state.size * state.scale, 0, 0, state.size, 0, state.rise]));
          parts.push({ str: '|', dir: 'ltr', width: Math.abs(glyph.width / 1000 * transform[0]), height: Math.hypot(transform[2], transform[3]), transform, fontName: state.font, hasEOL: false });
        }
        const advance = (glyph.width / 1000 * state.size + state.char + (glyph.isSpace ? state.word : 0)) * state.scale;
        state.matrix = multiply(state.matrix, [1, 0, 0, 1, advance, 0]);
      }
    }
  }
  // 大きい絶対値の線は上下2個の同じ部品で描かれるため、一つの選択領域にまとめる。
  const bars = [];
  for (const part of parts) {
    const previous = bars.find(bar => bar.fontName === part.fontName && Math.abs(bar.transform[4] - part.transform[4]) < 0.1 && Math.abs(bar.transform[5] - part.transform[5]) < part.height);
    if (previous) {
      const bottom = Math.min(previous.transform[5], part.transform[5]);
      const top = Math.max(previous.transform[5] + previous.height, part.transform[5] + part.height);
      previous.transform[5] = bottom; previous.height = top - bottom;
      previous.transform[3] = previous.height;
    } else bars.push({ ...part, transform: [...part.transform] });
  }
  return [...bars, ...fractions];
}

export function repairMathText(content, fonts, bars = []) {
  const items = content.items.map(item => 'str' in item ? { ...item, transform: [...item.transform] } : item);
  for (const item of items) {
    if (!('str' in item)) continue;
    const name = family(fonts[item.fontName]);
    if (/^CMSY\d+$/.test(name) && (item.str.endsWith('6') || item.str.endsWith('7'))) {
      const target = items.find(other => 'str' in other && other !== item && other.str === (item.str.endsWith('6') ? '=' : '→') && Math.abs(other.transform[4] - item.transform[4] - item.width) < 0.2 && Math.abs(other.transform[5] - item.transform[5]) < 0.2);
      if (target) { target.str = item.str.endsWith('6') ? '≠' : '↦'; item.str = item.str.slice(0, -1); }
    }
    if (/^MSBM\d+$/.test(name) && item.str === '9') item.str = '↛';
    if (/^CMEX\d+$/.test(name)) item.str = item.str.replaceAll('\uf8f1', '⎧').replaceAll('\uf8f2', '⎨').replaceAll('\uf8f3', '⎩');
  }
  for (const bar of bars) {
    if (bar.str === '⁄') {
      const y = bar.transform[5] + bar.height / 4, x = bar.transform[4];
      const tokens = items.filter(item => 'str' in item && item.str.trim() && item.transform[4] >= x - 0.5 && item.transform[4] <= x + bar.width + 0.5 && Math.abs(item.transform[5] - y) < bar.height * 1.2);
      // 罫線を分数と誤認しないよう、線の上下に数式の文字がある場合だけ補う。
      const above = tokens.filter(item => item.transform[5] > y + 0.5), below = tokens.filter(item => item.transform[5] < y - 0.5);
      if (!above.length || !below.length) continue;
      const denominator = below.sort((a, b) => Math.abs(a.transform[5] - y) - Math.abs(b.transform[5] - y))[0];
      items.splice(items.indexOf(denominator), 0, bar);
      continue;
    }
    // 文字順は既存の段落順を保ち、同じ数式の最寄り文字の直前・直後に補う。
    let nearest = -1, distance = Infinity;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]; if (!('str' in item) || !item.str.trim() || item.height === 0) continue;
      const dx = bar.transform[4] - item.transform[4], dy = bar.transform[5] - item.transform[5];
      const score = Math.abs(dy) * 8 + Math.abs(dx);
      if (score < distance) { distance = score; nearest = i; }
    }
    if (nearest >= 0) items.splice(nearest + (items[nearest].transform[4] < bar.transform[4] ? 1 : 0), 0, bar);
  }
  return { ...content, items };
}
