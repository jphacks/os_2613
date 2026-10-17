'use dom';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { edgeTurn, horizontalTurn } from './gestures.mjs';
import { measuredPagesAsync, pageAtOffset } from './pagination.mjs';
import { fontFamilies, type DisplayPreferences } from './preferences.mjs';

type Paint = { background: string; ink: string; muted: string; accent: string; chosen: string };
export type Props = {
  visuals?: import('../study/visuals.mjs').StudyVisual[];
  text: string; start: number; sub: number; marks: number[]; faded: number | null; picking: boolean; draft: number | null;
  guide: boolean; running: boolean; speed: number; display: DisplayPreferences; paint: Paint; disabled: boolean;
  focus: { offset: number; token: number } | null;
  onPosition: (offset: number) => void;
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
  const rootRef = useRef<HTMLDivElement>(null), viewRef = useRef<HTMLDivElement>(null), textRef = useRef<HTMLDivElement>(null), measureRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const [layout, setLayout] = useState({ count: 1, width: 0, starts: [0, 0] });
  const [cursor, setCursor] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [edge, setEdge] = useState<'next' | 'prev' | null>(null);
  const anchor = useRef({ text, start, offset: start });
  const measured = useRef('');
  const measuring = useRef(''), measurement = useRef(0);
  const fontRevision = useRef(0);
  const [calculating, setCalculating] = useState(false);
  const focusSeen = useRef<number | null>(null);
  const step = Math.round(display.fontSize * display.lineHeight);
  const page = Math.min(Math.max(0, sub), layout.count - 1);
  const begin = layout.starts[page] ?? 0, end = layout.starts[page + 1] ?? text.length;
  const chars = useMemo(() => {
    if (!layout.width) return [];
    let position = start + begin;
    return Array.from(text.slice(begin, end)).map(char => { const begin = position; position += char.length; return { char, begin, end: position }; });
  }, [text, start, begin, end, layout.width]);

  const measure = useCallback(() => {
    const view = viewRef.current, body = measureRef.current;
    if (!view || !body || !view.clientWidth || !view.clientHeight) return;
    const perPage = Math.max(1, Math.floor(view.clientWidth / step));
    const width = perPage * step;
    const signature = `${text}:${start}:${width}:${view.clientHeight}:${display.font}:${display.fontSize}:${step}:${fontRevision.current}`;
    if (measuring.current === signature) return;
    if (measured.current === signature) {
      measurement.current++; measuring.current = ''; setCalculating(false); return;
    }
    const job = ++measurement.current;
    measuring.current = signature;
    setCalculating(true);
    const sameText = anchor.current.text === text && anchor.current.start === start && !!measured.current;
    const node = body.firstChild;
    const right = body.getBoundingClientRect().right;
    const range = document.createRange();
    const pending = node ? measuredPagesAsync(text, offset => {
      range.setStart(node, offset); range.setEnd(node, offset + (text.codePointAt(offset)! > 0xffff ? 2 : 1));
      return Math.max(0, Math.floor((right - range.getBoundingClientRect().right + 0.5) / width));
    }, { shouldCancel: () => measurement.current !== job }) : Promise.resolve([0, 0]);
    void pending.then(starts => {
      if (!starts || measurement.current !== job) return;
      const count = starts.length - 1;
      measured.current = signature;
      setLayout({ count, width, starts });
      latest.current.onPages(count);
      // 設定や画面幅が変わっても、読んでいた文字のあるページを残す。
      if (sameText) latest.current.onReflow(pageAtOffset(starts, anchor.current.offset - start));
    }).finally(() => { if (measurement.current === job) { measuring.current = ''; setCalculating(false); } });
  }, [text, start, step, display.font, display.fontSize]);
  useLayoutEffect(() => {
    // iPhone では内部のWebViewの中で描かれ、そのページの高さが0のままだと紙面が潰れる。
    // WebViewの中にいるときだけ、ページ全体の高さを画面いっぱいにする（Webでは親の高さに従う）。
    if ((window as any).ReactNativeWebView) {
      for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
        if (el) { el.style.height = '100%'; el.style.margin = '0'; }
      }
    }
    let active = true;
    measure();
    if (document.fonts?.status === 'loading') void document.fonts.ready.then(() => { if (active) { fontRevision.current++; measure(); } });
    const view = viewRef.current;
    if (!view) return;
    const observer = new ResizeObserver(measure); observer.observe(view);
    return () => { active = false; observer.disconnect(); measurement.current++; measuring.current = ''; };
  }, [measure]);
  useEffect(() => {
    if (!layout.width) return;
    const offset = start + (layout.starts[page] ?? 0);
    anchor.current = { text, start, offset }; setCursor(0);
    latest.current.onVisible(offset);
  }, [page, layout, text, start]);
  useEffect(() => {
    if (!focus || focusSeen.current === focus.token || !layout.width || focus.offset < start || focus.offset > start + text.length) return;
    focusSeen.current = focus.token;
    latest.current.onReflow(pageAtOffset(layout.starts, focus.offset - start));
  }, [focus, layout, start, text]);
  useEffect(() => {
    if (!guide || !running || picking || ghost || disabled || calculating || !layout.width) return;
    const timer = setTimeout(() => {
      const next = cursor + 1;
      if (next >= chars.length) latest.current.onAdvance(); else setCursor(next);
    }, chars[cursor]?.char === '\n' ? 0 : 60000 / speed);
    return () => clearTimeout(timer);
  }, [guide, running, picking, ghost, disabled, calculating, cursor, speed, page, layout, chars]);
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

  useEffect(() => {
    if (picking || ghost || disabled || calculating || !layout.width) return;
    const char = chars[guide ? cursor : 0];
    if (char) latest.current.onPosition(char.begin);
  }, [cursor, chars, guide, picking, ghost, disabled, calculating, layout.width]);

  function pointOffset(x: number, y: number) {
    const root = rootRef.current?.getBoundingClientRect();
    if (!root || x < root.left || x > root.right || y < root.top || y > root.bottom) return null;
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-offset]');
    if (hit && textRef.current?.contains(hit)) return Number(hit.dataset.offset);
    // 行間や紙の余白へ落としても、表示中の文字のうち一番近い位置を選べる。
    let best: number | null = null, distance = Infinity;
    textRef.current?.querySelectorAll<HTMLElement>('[data-i]').forEach(node => {
      if (!node.textContent?.trim()) return;
      const rect = node.getBoundingClientRect();
      const d = Math.hypot(x - (rect.left + rect.right) / 2, y - (rect.top + rect.bottom) / 2);
      if (d < distance) { best = Number(node.dataset.offset); distance = d; }
    });
    return best;
  }
  function movePoint(x: number, y: number) {
    const offset = pointOffset(x, y);
    setDragOffset(offset);
    const character = offset === null ? null : textRef.current?.querySelector<HTMLElement>(`[data-i][data-offset="${offset}"]`);
    const rect = character?.getBoundingClientRect();
    setGhost(rect ? { x: rect.left + rect.width / 2, y: rect.bottom - 10 } : { x, y });
    const root = rootRef.current?.getBoundingClientRect();
    setEdge(root && y >= root.top && y <= root.bottom ? edgeTurn(x, root.left, root.width) : null);
  }
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || calculating || !event.isPrimary || event.button !== 0 || gesture.current) return;
    let target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mark]') : null;
    if (!target && !picking) {
      let nearest = 18;
      rootRef.current?.querySelectorAll<HTMLElement>('[data-mark]').forEach(node => {
        const rect = node.getBoundingClientRect();
        const distance = Math.hypot(Math.max(rect.left - event.clientX, 0, event.clientX - rect.right), Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom));
        if (distance < nearest) { nearest = distance; target = node; }
      });
    }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, from: target ? Number(target.dataset.mark) : null, dragged: false, placing: picking };
    if (target) event.preventDefault();
    latest.current.onPause();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (picking) movePoint(event.clientX, event.clientY);
  }
  function pointerMove(event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.from !== null && !current.dragged && !current.placing && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 4) {
      // 掴んでいる間はDOM内で動かす。親へ移動開始を通知して紙面を再構成すると、
      // Expo WebViewでポインターの捕捉が切れるため、確定時だけ保存を通知する。
      current.dragged = true;
    }
    if (current.dragged || current.placing) movePoint(event.clientX, event.clientY);
  }
  function finish(event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null; setGhost(null); setDragOffset(null); setEdge(null);
    if (rootRef.current?.hasPointerCapture(event.pointerId)) rootRef.current.releasePointerCapture(event.pointerId);
    if (current.dragged && current.from !== null) { latest.current.onDrop(current.from, cancelled ? null : pointOffset(event.clientX, event.clientY)); return; }
    if (cancelled) return;
    if (current.placing) { const offset = pointOffset(event.clientX, event.clientY); if (offset !== null) latest.current.onPick(offset); return; }
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    const turn = horizontalTurn(dx, dy);
    if (turn) { turn === 'next' ? latest.current.onNext() : latest.current.onPrev(); return; }
    if (Math.hypot(dx, dy) > 12) return;
    if (current.from !== null) { latest.current.onMarkPress(current.from); return; }
    const rect = rootRef.current!.getBoundingClientRect();
    event.clientX < rect.left + rect.width / 2 ? latest.current.onNext() : latest.current.onPrev();
  }
  // 紙面の外へ動かした場合や、親の描画でcaptureが外れた場合も、離す操作を受け取る。
  useEffect(() => {
    const move = (event: PointerEvent) => pointerMove(event);
    const up = (event: PointerEvent) => finish(event);
    const cancel = (event: PointerEvent) => finish(event, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  });
  function ribbon(offset: number, first = false) {
    const marked = marks.includes(offset), chosen = picking && draft === offset;
    if (!marked && !chosen) return null;
    return <span role="button" tabIndex={0} aria-label="しおり" data-offset={offset} data-mark={marked ? offset : undefined}
      onKeyDown={event => { if (event.key === 'Enter' && marked && !picking) latest.current.onMarkPress(offset); }}
      style={{ ...styles.ribbon, ...(first ? { top: 0, right: 0, left: 'auto' } : {}), color: paint.accent, opacity: marked && (faded === offset || (ghost && gesture.current?.from === offset)) ? 0.25 : 1 }}><span style={{ pointerEvents: 'none', display: 'block' }}><Ribbon /></span></span>;
  }
  return <div ref={rootRef} style={{ ...styles.root, background: paint.background, cursor: ghost ? 'grabbing' : undefined }} onDragStart={event => event.preventDefault()} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}>
    {calculating && <div role="status" style={{ position: 'absolute', top: 4, left: 24, color: paint.muted, fontSize: 12, pointerEvents: 'none' }}>ページを整えています…</div>}
    <div ref={viewRef} style={styles.view}>
      <div ref={measureRef} aria-hidden="true" style={{ ...styles.text, visibility: 'hidden', pointerEvents: 'none', fontFamily: fontFamilies[display.font], fontSize: display.fontSize, lineHeight: `${step}px` }}>{text}</div>
      <div style={{ ...styles.clip, width: layout.width || '100%' }}><div ref={textRef} style={{ ...styles.text, color: paint.ink, fontFamily: fontFamilies[display.font], fontSize: display.fontSize, lineHeight: `${step}px` }}>
      {page === 0 && ribbon(start, true)}{chars.map(({ char, end }, index) => <span key={end} data-i={index} data-offset={end} style={{ position: 'relative', display: char === '\n' ? 'inline' : 'inline-block', opacity: guide ? Math.max(0.50, 1 - Math.abs(index - cursor) * 0.13) : 1, fontWeight: guide && Math.abs(index - cursor) <= 2 ? 700 : 400, transform: guide ? `translateX(${-Math.max(0, 1 - Math.abs(index - cursor) / 5) * 2}px) scale(${1 + Math.max(0, 1 - Math.abs(index - cursor) / 5) * 0.09})` : undefined, textShadow: guide && Math.abs(index - cursor) < 4 ? `0 1px 1px color-mix(in srgb, ${paint.muted} 20%, transparent)` : undefined, transition: 'opacity 100ms ease, transform 100ms ease, text-shadow 100ms ease', background: (picking && draft === end) || (ghost && dragOffset === end) ? paint.chosen : undefined }}>{char}{ribbon(end)}</span>)}
    </div></div></div>
    {!picking && !ghost && <>
      {page < layout.count - 1 && <span aria-hidden="true" style={{ ...styles.turnHint, left: 4, color: paint.ink }}>←</span>}
      {page > 0 && <span aria-hidden="true" style={{ ...styles.turnHint, right: 4, color: paint.ink }}>→</span>}
    </>}
    {ghost && <span aria-hidden="true" style={{ position: 'fixed', pointerEvents: 'none', left: ghost.x - 9, top: ghost.y - 5, zIndex: 9999, color: paint.accent, transform: 'scale(1.18) rotate(-5deg)', transformOrigin: 'center top', filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.20))' }}><Ribbon /></span>}
    {ghost && edge && <span aria-hidden="true" style={{ position: 'absolute', bottom: 8, left: edge === 'next' ? 8 : undefined, right: edge === 'prev' ? 8 : undefined, color: paint.ink, background: paint.background, pointerEvents: 'none', padding: 6 }}>{edge === 'next' ? '‹ 次のページへ' : '前のページへ ›'}</span>}
  </div>;
}
const styles: Record<string, React.CSSProperties> = {
  root: { height: '100%', width: '100%', padding: '24px 24px', boxSizing: 'border-box', userSelect: 'none', touchAction: 'none', position: 'relative' },
  turnHint: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: 22, opacity: 0.16, pointerEvents: 'none', lineHeight: 1 },
  view: { height: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', minHeight: 0, overflow: 'hidden' },
  clip: { position: 'relative', height: '100%', overflow: 'hidden' },
  text: { position: 'absolute', top: 0, right: 0, height: '100%', width: 'max-content', writingMode: 'vertical-rl', letterSpacing: '0.05em', whiteSpace: 'pre-wrap' },
  // 印のために行が伸びないよう、文字の上へ重ねる。
  ribbon: { position: 'absolute', top: '100%', left: '50%', width: 30, height: 38, padding: '5px 6px', boxSizing: 'border-box', transform: 'translate(-50%, -24px)', zIndex: 20, cursor: 'grab', touchAction: 'none', lineHeight: 0 },
};
