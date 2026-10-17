import { Fragment, useMemo } from 'react';
import { mathSegments, studyNotation } from './math.mjs';

// Markup comes only from KaTeX with trust disabled, never directly from model HTML.
export function MathText({ text, formula = false }: { text: string; formula?: boolean }) {
  text = studyNotation(text);
  const parts = useMemo(() => mathSegments(text, formula), [text, formula]);
  let position = 0;
  return <>{parts.map((part, i) => {
    const before = text.slice(position, part.start); position = part.end;
    return <Fragment key={i}>{before}<span className="study-math-scroll" style={{ display: part.display ? 'block' : 'inline-block', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', verticalAlign: 'middle', padding: '0.12em 0' }} dangerouslySetInnerHTML={{ __html: part.markup }} /></Fragment>;
  })}{text.slice(position)}</>;
}
