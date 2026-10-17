import { validOffset } from '../bookmark/model.mjs';
export const characterLimit = 100000;
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
    if (!from || !to || from === to || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 40 || typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 240 || !item.quote.includes(from.name) || !item.quote.includes(to.name) || !item.quote.includes(item.label)) continue;
    const start = text.indexOf(item.quote); if (start < 0) continue;
    relations.push({ from: from.id, to: to.id, label: item.label, quote: item.quote, start, end: start + item.quote.length });
  }
  return { people, relations };
}
