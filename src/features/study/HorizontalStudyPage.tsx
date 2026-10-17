'use dom';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Props } from '@/features/reader/VerticalPage';
import { fontFamilies } from '@/features/reader/preferences.mjs';
import { studyLines } from './format.mjs';
import { StudyFigure, studyPalette } from './StudyFigure';
import { mathSegments } from './math.mjs';

export default function HorizontalStudyPage(props: Props) {
  const { text, start, paint, display, guide, running, speed, disabled, picking, marks, draft, focus } = props;
  const root = useRef<HTMLDivElement>(null), latest = useRef(props); latest.current = props;
  const [cursor, setCursor] = useState(start);
  const dragging = useRef<number | null>(null);
  const lines = useMemo(() => studyLines(text), [text]);
  const equations = useMemo(() => lines.map(line => mathSegments(line.text)), [lines]);
  const palette = studyPalette(paint.ink);
  const figures = useMemo(() => (props.visuals ?? []).map(visual => {
    const at = text.indexOf(visual.after);
    return { visual, line: at < 0 ? -1 : lines.findIndex(line => line.start + line.text.length >= at + visual.after.length) };
  }), [props.visuals, text, lines]);
  useEffect(() => {
    if (!(window as any).ReactNativeWebView) return;
    for (const node of [document.documentElement, document.body, document.getElementById('root')]) {
      if (node) { node.style.height = '100%'; node.style.margin = '0'; }
    }
  }, []);
  useEffect(() => { latest.current.onPages(1); latest.current.onReflow(0); setCursor(start); }, [text, start]);
  useEffect(() => {
    if (!focus || !root.current) return;
    setCursor(focus.offset);
    root.current.querySelector<HTMLElement>(`[data-end="${focus.offset}"]`)?.scrollIntoView({ block: 'center' });
  }, [focus]);
  useEffect(() => {
    if (!guide || !running || disabled || picking) return;
    const timer = setTimeout(() => {
      const offset = cursor - start;
      if (offset >= text.length) { latest.current.onPause(); return; }
      const next = cursor + (text.codePointAt(offset)! > 0xffff ? 2 : 1);
      setCursor(next); latest.current.onPosition(next); latest.current.onVisible(next);
      root.current?.querySelector<HTMLElement>(`[data-end="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    }, text[cursor - start] === '\n' ? 0 : 60000 / speed);
    return () => clearTimeout(timer);
  }, [cursor, guide, running, speed, disabled, picking, text, start]);
  useEffect(() => {
    const pause = () => { if (document.hidden) latest.current.onPause(); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  function visible() {
    if (!root.current || running) return;
    const top = root.current.getBoundingClientRect().top;
    const line = [...root.current.querySelectorAll<HTMLElement>('[data-line]')].find(node => node.getBoundingClientRect().bottom > top + 12);
    if (line) { const offset = Number(line.dataset.line); latest.current.onVisible(offset); latest.current.onPosition(offset); setCursor(offset); }
  }
  function mark(offset: number) {
    if (!marks.includes(offset)) return null;
    return <button aria-label="しおりを開く" draggable onDragStart={event => { dragging.current = offset; event.dataTransfer.setData('text/plain', String(offset)); latest.current.onDragStart(offset); }}
      onDragEnd={() => { if (dragging.current !== null) latest.current.onDrop(dragging.current, null); dragging.current = null; }}
      onClick={event => { event.stopPropagation(); latest.current.onPause(); latest.current.onMarkPress(offset); }} style={{ border: 0, background: paint.chosen, color: paint.accent, cursor: 'pointer', borderRadius: 4 }}>◆</button>;
  }
  return <div ref={root} onScroll={visible} onDragOver={event => event.preventDefault()} onDrop={event => {
    event.preventDefault(); const hit = (event.target as Element).closest<HTMLElement>('[data-end]');
    if (dragging.current !== null) latest.current.onDrop(dragging.current, hit ? Number(hit.dataset.end) : null); dragging.current = null;
  }} style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', background: paint.background, color: paint.ink, writingMode: 'horizontal-tb', padding: 'clamp(16px, 3vw, 40px)', scrollPadding: 24 }}>
    <style>{`.study-math-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }`}</style>
    <article style={{ maxWidth: 820, margin: '0 auto', fontFamily: fontFamilies[display.font], fontSize: display.fontSize, lineHeight: display.lineHeight, overflowWrap: 'anywhere' }}>
      {mark(start)}
      {lines.map((line, i) => {
        let offset = start + line.start;
        const Tag = line.title ? 'h1' : line.heading ? 'h2' : 'p';
        const tone = palette[line.tone];
        // One rule below the whole mixed text/math line clears even deep subscripts.
        const sharedUnderline = equations[i].length > 0 && line.emphasis.length > 0;
        return <Fragment key={i}><Tag data-line={offset} style={{ whiteSpace: 'pre-wrap', fontSize: line.title ? '1.55em' : line.heading ? '1.18em' : '1em', lineHeight: line.heading ? 1.65 : undefined,
          fontWeight: line.heading || line.callout ? 750 : 400, margin: line.heading ? '1.25em 0 0.65em' : line.callout ? '1em 0 1.3em' : '0.55em 0', minHeight: line.text ? undefined : '0.6em',
          color: line.heading ? (line.tone === 'neutral' ? paint.accent : tone) : line.tone === 'warning' ? tone : paint.ink,
          border: line.callout ? `2px solid ${paint.accent}` : undefined, borderRadius: line.callout ? 10 : undefined,
          borderLeft: line.callout ? `2px solid ${paint.accent}` : line.heading && !line.title ? `4px solid ${tone}` : undefined,
          boxSizing: 'border-box', minWidth: 0,
          padding: line.callout ? '14px 18px 18px' : undefined, background: line.callout ? paint.chosen : undefined,
          paddingLeft: line.heading && !line.title ? 12 : line.callout ? 18 : undefined }}>
          {line.callout && <span style={{ display: 'block', fontSize: '0.72em', letterSpacing: '0.08em', fontWeight: 800, color: paint.accent, marginBottom: 8 }}>{({ formula: '覚えておきたい公式', definition: '大切な定義', keypoint: '重要ポイント' })[line.callout]}</span>}
          <span style={sharedUnderline ? { display: 'inline-block', maxWidth: '100%', borderBottom: `2px solid ${paint.accent}`, paddingBottom: '0.18em' } : undefined}>
          {Array.from(line.text).map((char, j) => {
            const begin = offset; offset += char.length; const end = offset;
            const local = begin - start - line.start;
            const bold = line.emphasis.some(([a, b]) => local >= a && local < b);
            const active = guide && cursor > begin && cursor <= end;
            const equation = equations[i].find(part => local >= part.start && local < part.end);
            if (equation) {
              if (local !== equation.start) return null;
              const mathBegin = start + line.start + equation.start, mathEnd = start + line.start + equation.end;
              const highlighted = guide && cursor >= mathBegin && cursor <= mathEnd;
              let markerPosition = mathBegin;
              return <span key={j} data-end={mathEnd} onClick={() => {
                if (disabled) return;
                latest.current.onPause();
                if (picking) latest.current.onPick(mathEnd); else { setCursor(mathBegin); latest.current.onPosition(mathBegin); latest.current.onVisible(mathBegin); }
              }} style={{ display: equation.display ? 'block' : 'inline-block', maxWidth: '100%', verticalAlign: 'middle', position: 'relative',
                padding: '0.2em 0.1em', fontSize: line.callout === 'formula' ? '1.18em' : undefined, outline: highlighted ? `1px solid ${paint.accent}` : undefined,
                background: highlighted || (picking && draft !== null && draft >= mathBegin && draft <= mathEnd) ? paint.chosen : undefined }}>
                <span className="study-math-scroll" style={{ display: 'inline-block', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', verticalAlign: 'middle' }} dangerouslySetInnerHTML={{ __html: equation.markup }} />
                {Array.from(equation.raw).map((character, n) => {
                  markerPosition += character.length; const at = markerPosition;
                  return <span key={n} aria-hidden data-end={at} style={{ position: 'absolute', width: 1, height: 1, top: 0, left: 0, opacity: 0, pointerEvents: 'none' }} />;
                })}
                {marks.filter(at => at > mathBegin && at <= mathEnd).map(at => <span key={at}>{mark(at)}</span>)}
              </span>;
            }
            return <span key={j} data-end={end} onClick={() => {
              if (disabled) return;
              latest.current.onPause();
              if (picking) latest.current.onPick(end); else { setCursor(begin); latest.current.onPosition(begin); latest.current.onVisible(begin); }
            }} style={{ fontWeight: bold ? 800 : undefined, color: bold ? (line.tone === 'neutral' ? paint.accent : tone) : undefined,
              background: active || (picking && draft === end) ? paint.chosen : undefined,
              outline: active ? `1px solid ${paint.accent}` : undefined, textDecoration: !sharedUnderline && (active || bold) ? 'underline' : undefined, textDecorationThickness: bold ? '2px' : undefined,
              textUnderlineOffset: '0.2em', cursor: picking ? 'crosshair' : undefined }}>{char}{mark(end)}</span>;
          })}
          </span>
        </Tag>{figures.filter(item => item.line === i).map((item, n) => <StudyFigure key={n} visual={item.visual} ink={paint.ink} background={paint.background} />)}</Fragment>;
      })}
    </article>
  </div>;
}
