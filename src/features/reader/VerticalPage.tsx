'use dom';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { edgeTurn, horizontalTurn, pageForAnchor } from './gestures.mjs';
import { fontFamilies, type DisplayPreferences } from './preferences.mjs';

type Paint = { background: string; ink: string; muted: string; accent: string; chosen: string };
type Props = {
  text: string; start: number; sub: number; marks: number[]; faded: number | null; picking: boolean; draft: number | null;
  guide: boolean; running: boolean; speed: number; display: DisplayPreferences; paint: Paint; disabled: boolean;
  focus: { offset: number; token: number } | null;
  onPages: (count: number) => void; onReflow: (page: number) => void; onVisible: (offset: number) => void;
  onNext: () => void; onPrev: () => void; onAdvance: () => void; onPause: () => void;
  onPick: (offset: number) => void; onMarkPress: (offset: number) => void;
  onDragStart: (offset: number) => void; onDrop: (from: number, to: number | null) => void;
  dom?: import('expo/dom').DOMProps;
};
type Gesture = { id: number; x: number; y: number; from: number | null; dragged: boolean; placing: boolean };
function Ribbon() { return <svg width="18" height="28" viewBox="0 0 18 28" aria-hidden="true"><path d="M1 1h16v25l-8-6-8 6z" fill="currentColor" /></svg>; }

export default function VerticalPage(props: Props) {
  const { text, start, sub, marks, faded, picking, draft, guide, running, speed, display, paint, disabled, focus } = props;
  const rootRef = useRef<HTMLDivElement>(null), viewRef = useRef<HTMLDivElement>(null), textRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const [layout, setLayout] = useState({ count: 1, width: 0, pageOf: [] as number[] });
  const [cursor, setCursor] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [edge, setEdge] = useState<'next' | 'prev' | null>(null);
  const anchor = useRef({ text, start, offset: start });
  const measured = useRef('');
  const focusSeen = useRef<number | null>(null);
  const step = Math.round(display.fontSize * display.lineHeight);
  const chars = useMemo(() => {
    let position = start;
    return Array.from(text).map(char => { const begin = position; position += char.length; return { char, begin, end: position }; });
  }, [text, start]);
  const page = sub < 0 ? layout.count - 1 : Math.min(Math.max(0, sub), layout.count - 1);

  const measure = useCallback(() => {
    const view = viewRef.current, body = textRef.current;
    if (!view || !body || !view.clientWidth || !view.clientHeight) return;
    const perPage = Math.max(1, Math.floor(view.clientWidth / step));
    const width = perPage * step;
    const right = body.getBoundingClientRect().right;
    const pageOf = Array.from(body.querySelectorAll<HTMLElement>('[data-i]')).map(node => Math.max(0, Math.floor((right - node.getBoundingClientRect().right + 0.5) / width)));
    const count = Math.max(1, ...pageOf.map(value => value + 1));
    const signature = `${text}:${start}:${width}:${view.clientHeight}:${display.font}:${display.fontSize}:${step}:${pageOf.join(',')}`;
    if (measured.current === signature) return;
    const sameText = anchor.current.text === text && anchor.current.start === start && !!measured.current;
    measured.current = signature;
    setLayout({ count, width, pageOf });
    latest.current.onPages(count);
    // 設定や画面幅が変わっても、読んでいた文字のあるページを残す。
    if (sameText) latest.current.onReflow(pageForAnchor(chars.map(char => char.end), pageOf, anchor.current.offset));
  }, [text, start, step, display.font, display.fontSize, chars]);
  useLayoutEffect(() => {
    let active = true;
    measure();
    void document.fonts?.ready.then(() => { if (active) measure(); });
    const view = viewRef.current;
    if (!view) return;
    const observer = new ResizeObserver(measure); observer.observe(view);
    return () => { active = false; observer.disconnect(); };
  }, [measure]);
  useEffect(() => {
    if (!layout.width) return;
    const first = layout.pageOf.findIndex(value => value === page);
    const offset = chars[first]?.begin ?? start;
    anchor.current = { text, start, offset }; setCursor(Math.max(0, first));
    latest.current.onVisible(offset);
  }, [page, layout, text, start, chars]);
  useEffect(() => {
    if (!focus || focusSeen.current === focus.token || !layout.width || focus.offset < start || focus.offset > start + text.length) return;
    focusSeen.current = focus.token;
    latest.current.onReflow(pageForAnchor(chars.map(char => char.end), layout.pageOf, focus.offset));
  }, [focus, layout, start, text, chars]);
  useEffect(() => {
    if (!guide || !running || picking || ghost || disabled || !layout.width) return;
    const timer = setTimeout(() => {
      const next = cursor + 1;
      if (next >= chars.length || layout.pageOf[next] !== page) latest.current.onAdvance(); else setCursor(next);
    }, chars[cursor]?.char === '\n' ? 0 : 60000 / speed);
    return () => clearTimeout(timer);
  }, [guide, running, picking, ghost, disabled, cursor, speed, page, layout, chars]);
  useEffect(() => {
    const pause = () => { if (document.hidden) latest.current.onPause(); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (!edge || !ghost) return;
    // 方向が同じ間は待機を作り直さない。指の小さな揺れでも端送りを続ける。
    const timer = setInterval(() => { if (gesture.current?.dragged || gesture.current?.placing) edge === 'next' ? latest.current.onNext() : latest.current.onPrev(); }, 650);
    return () => clearInterval(timer);
  }, [edge, !!ghost]);

  function pointOffset(x: number, y: number) {
    const root = rootRef.current?.getBoundingClientRect();
    if (!root || x < root.left || x > root.right || y < root.top || y > root.bottom) return null;
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-offset]');
    if (hit && textRef.current?.contains(hit)) return Number(hit.dataset.offset);
    // 行間や紙の余白へ落としても、表示中の文字のうち一番近い位置を選べる。
    let best: number | null = null, distance = Infinity;
    textRef.current?.querySelectorAll<HTMLElement>('[data-i]').forEach(node => {
      if (layout.pageOf[Number(node.dataset.i)] !== page || !node.textContent?.trim()) return;
      const rect = node.getBoundingClientRect();
      const d = Math.hypot(x - (rect.left + rect.right) / 2, y - (rect.top + rect.bottom) / 2);
      if (d < distance) { best = Number(node.dataset.offset); distance = d; }
    });
    return best;
  }
  function movePoint(x: number, y: number) {
    setGhost({ x, y });
    const root = rootRef.current?.getBoundingClientRect();
    setEdge(root && y >= root.top && y <= root.bottom ? edgeTurn(x, root.left, root.width) : null);
  }
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !event.isPrimary || event.button !== 0 || gesture.current) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mark]') : null;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, from: target ? Number(target.dataset.mark) : null, dragged: false, placing: picking };
    latest.current.onPause();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (picking) movePoint(event.clientX, event.clientY);
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.from !== null && !current.dragged && !current.placing && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 7) {
      current.dragged = true; latest.current.onDragStart(current.from);
    }
    if (current.dragged || current.placing) movePoint(event.clientX, event.clientY);
  }
  function finish(event: React.PointerEvent<HTMLDivElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null; setGhost(null); setEdge(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.dragged && current.from !== null) { latest.current.onDrop(current.from, cancelled ? null : pointOffset(event.clientX, event.clientY)); return; }
    if (cancelled) return;
    if (current.placing) { const offset = pointOffset(event.clientX, event.clientY); if (offset !== null) latest.current.onPick(offset); return; }
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    const turn = horizontalTurn(dx, dy);
    if (turn) { turn === 'next' ? latest.current.onNext() : latest.current.onPrev(); return; }
    if (Math.hypot(dx, dy) > 12) return;
    if (current.from !== null) { latest.current.onMarkPress(current.from); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    event.clientX < rect.left + rect.width / 2 ? latest.current.onNext() : latest.current.onPrev();
  }
  function ribbon(offset: number, first = false) {
    const marked = marks.includes(offset), chosen = picking && draft === offset;
    if (!marked && !chosen) return null;
    return <span role="button" tabIndex={0} aria-label="しおり" data-offset={offset} data-mark={marked ? offset : undefined}
      onKeyDown={event => { if (event.key === 'Enter' && marked && !picking) latest.current.onMarkPress(offset); }}
      style={{ ...styles.ribbon, ...(first ? { top: 0, right: 0, left: 'auto' } : {}), color: paint.accent, opacity: marked && faded === offset ? 0.25 : 1 }}><Ribbon /></span>;
  }
  return <div ref={rootRef} style={{ ...styles.root, background: paint.background }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => { if (gesture.current?.id === event.pointerId) finish(event, true); }}>
    <div ref={viewRef} style={styles.view}><div style={{ ...styles.clip, width: layout.width || '100%' }}><div ref={textRef} style={{ ...styles.text, color: guide ? paint.muted : paint.ink, fontFamily: fontFamilies[display.font], fontSize: display.fontSize, lineHeight: `${step}px`, transform: `translateX(${page * layout.width}px)` }}>
      {ribbon(start, true)}{chars.map(({ char, end }, index) => <span key={end} data-i={index} data-offset={end} style={{ position: 'relative', color: guide && index <= cursor ? paint.ink : undefined, background: picking && draft === end ? paint.chosen : undefined }}>{char}{ribbon(end)}</span>)}
    </div></div></div>
    {ghost && <span aria-hidden="true" style={{ position: 'fixed', pointerEvents: 'none', left: ghost.x - 9, top: ghost.y - 5, zIndex: 9999, color: paint.accent }}><Ribbon /></span>}
    {ghost && edge && <span aria-hidden="true" style={{ position: 'absolute', bottom: 8, left: edge === 'next' ? 8 : undefined, right: edge === 'prev' ? 8 : undefined, color: paint.ink, background: paint.background, pointerEvents: 'none', padding: 6 }}>{edge === 'next' ? '‹ 次のページへ' : '前のページへ ›'}</span>}
  </div>;
}
const styles: Record<string, React.CSSProperties> = {
  root: { height: '100%', width: '100%', padding: '42px 24px', boxSizing: 'border-box', userSelect: 'none', touchAction: 'none', position: 'relative' },
  view: { height: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', minHeight: 0 },
  clip: { position: 'relative', height: '100%', overflow: 'hidden' },
  text: { position: 'absolute', top: 0, right: 0, height: '100%', width: 'max-content', writingMode: 'vertical-rl', letterSpacing: '0.05em', whiteSpace: 'pre-wrap' },
  // 印のために行が伸びないよう、文字の上へ重ねる。
  ribbon: { position: 'absolute', top: '100%', left: '50%', width: 18, height: 28, transform: 'translate(-50%, -6px)', zIndex: 3, cursor: 'grab', lineHeight: 0 },
};
