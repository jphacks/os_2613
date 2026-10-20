export function parsePdfMarks(raw) {
  const marks = JSON.parse(raw ?? '[]');
  if (!Array.isArray(marks) || marks.length > 200 || !marks.every(mark => typeof mark?.id === 'string' && typeof mark.source === 'string' && Number.isInteger(mark.page) && mark.page > 0 && (mark.offset === null || Number.isInteger(mark.offset) && mark.offset >= 0) && typeof mark.quote === 'string' && mark.quote.length <= 100)) throw new Error('PDF_MARKS_INVALID');
  return marks;
}
export function pdfCharacter(text, offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset >= text.length) return null;
  if (offset > 0 && /[\uDC00-\uDFFF]/.test(text[offset]) && /[\uD800-\uDBFF]/.test(text[offset - 1])) offset--;
  return { offset, length: text.codePointAt(offset) > 0xffff ? 2 : 1, quote: Array.from(text.slice(offset)).slice(0, 40).join('') };
}
