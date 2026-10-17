import { validOffset } from '../bookmark/model.mjs';
export const characterLimit = 100000;
export function characterPassages(text) {
  const sources = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + 1200);
    if (!validOffset(text, end)) end--;
    sources.push({ id: `s${sources.length + 1}`, quote: text.slice(start, end) });
    if (end === text.length) break;
    start = end - 300; if (!validOffset(text, start)) start--;
  }
  return sources;
}
export function relationshipPassages(text, people) {
  const candidates = [], seen = new Set();
  // 人物の初出付近に加え、本文中の各出現位置を起点に、両人物を含む短い資料を作る。
  for (const person of people) {
    let offset = 0; const positions = [];
    while ((offset = text.indexOf(person.name, offset)) >= 0) {
      positions.push(offset); offset += Math.max(1, person.name.length);
    }
    const sampled = positions.length <= 80 ? positions : Array.from({ length: 80 }, (_, index) => positions[Math.round(index * (positions.length - 1) / 79)]);
    for (const offset of sampled) {
      let start = Math.max(0, offset - 450), end = Math.min(text.length, start + 1200);
      if (!validOffset(text, start)) start++; if (!validOffset(text, end)) end--;
      if (!seen.has(start)) { seen.add(start); candidates.push({ start, quote: text.slice(start, end) }); }
    }
  }
  const sources = [];
  for (let a = 0; a < people.length; a++) for (let b = a + 1; b < people.length; b++) {
    const pair = candidates.filter(item => item.quote.includes(people[a].name) && item.quote.includes(people[b].name));
    pair.sort((a, b) => {
      const score = value => (value.quote.match(/友|妹|兄|姉|弟|親|父|母|妻|夫|師|弟子|人質|約束|殺|処刑|王/g) ?? []).length;
      return score(b) - score(a) || a.start - b.start;
    });
    // 複数の資料を参照できるが、引用はそれぞれ読了範囲内に限定する。
    const selected = [];
    for (const item of pair) {
      if (selected.some(other => Math.abs(other.start - item.start) < 600)) continue;
      selected.push(item); if (selected.length === 2) break;
    }
    for (const item of selected) sources.push({ id: `r${sources.length + 1}`, from: people[a].id, to: people[b].id, quote: item.quote });
  }
  return sources;
}
export function relationshipsFromPassages(value, text, people, sources) {
  if (!Array.isArray(value?.relations) || value.relations.length > 12) throw new Error('INVALID_RESULT');
  const byId = new Map(sources.map(item => [item.id, item]));
  const relations = value.relations.flatMap(item => {
    const source = byId.get(item?.sourceId);
    if (!source || !((item.from === source.from && item.to === source.to) || (item.from === source.to && item.to === source.from))) return [];
    return [{ ...item, quote: source.quote }];
  });
  return groundedGraph({ people, relations }, text);
}
export function graphFromPassages(value, text) {
  const sources = new Map(characterPassages(text).map(item => [item.id, item.quote]));
  if (!Array.isArray(value?.people) || !Array.isArray(value?.relations)) throw new Error('INVALID_RESULT');
  if (value.people.length > 8 || value.relations.length > 12) throw new Error('INVALID_RESULT');
  const rejected = { sourceIds: 0, names: 0 };
  function source(item) { const quote = sources.get(item?.sourceId); if (!quote) rejected.sourceIds++; return quote; }
  const people = value.people.flatMap(item => {
    const quote = source(item); if (!quote) return [];
    const at = typeof item.name === 'string' && item.name.trim() && item.name.length <= 40 ? quote.indexOf(item.name) : -1;
    if (at < 0) { rejected.names++; return []; }
    let start = Math.max(0, at - 35), end = Math.min(quote.length, Math.max(at + item.name.length, start + 120));
    if (!validOffset(quote, start)) start++; if (!validOffset(quote, end)) end--;
    return [{ id: item.id, name: item.name, quote: quote.slice(start, end) }];
  });
  const result = groundedGraph({ people, relations: value.relations.flatMap(item => { const quote = source(item); return quote ? [{ ...item, quote }] : []; }) }, text);
  if (value.people.length && !result.people.length) throw new Error('UNGROUNDED', { cause: { stage: 'character-evidence', candidates: value.people.length, ...rejected } });
  return result;
}
export function textToBookmark(text, marks, id) {
  const mark = marks.find(item => item.id === id);
  if (!mark || !validOffset(text, mark.offset)) throw new Error('INVALID_INPUT');
  return text.slice(0, mark.offset);
}
export function groundedGraph(value, text) {
  if (!Array.isArray(value?.people) || !Array.isArray(value?.relations) || value.people.length > 8 || value.relations.length > 12) throw new Error('INVALID_RESULT');
  const people = [], ids = new Set(), names = new Set();
  for (const item of value.people) {
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,30}$/.test(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 40 || names.has(item.name) || typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 120 || !item.quote.includes(item.name)) continue;
    const start = text.indexOf(item.quote); if (start < 0) continue;
    people.push({ id: item.id, name: item.name, quote: item.quote, start, end: start + item.quote.length }); ids.add(item.id); names.add(item.name);
  }
  if (value.people.length && !people.length) throw new Error('UNGROUNDED');
  const relations = [];
  for (const item of value.relations) {
    const from = people.find(person => person.id === item.from), to = people.find(person => person.id === item.to);
    if (!from || !to || from === to || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 40 || typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 1200 || !item.quote.includes(from.name) || !item.quote.includes(to.name) || !item.quote.includes(item.label)) continue;
    const start = text.indexOf(item.quote); if (start < 0) continue;
    relations.push({ from: from.id, to: to.id, label: item.label, quote: item.quote, start, end: start + item.quote.length });
  }
  return { people, relations };
}
