'use dom';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { reachedEnding } from './ending.mjs';
import { edgeTurn, horizontalTurn } from './gestures.mjs';
import { guideScrollLeft, guideRowWave, visibleScrollPage, guideOpacity } from './scroll-position.mjs';
import { measuredPagesAsync, pageAtOffset } from './pagination.mjs';
import { fontFamilies, type DisplayPreferences } from './preferences.mjs';
import { bindGuideKeyboard } from './guide-keyboard.mjs';

type Paint = { background: string; ink: string; muted: string; accent: string; chosen: string };
export type Props = {
  onReady?: () => void;
  onLoadError?: (message: string) => void;
  visuals?: import('../study/visuals.mjs').StudyVisual[];
  text: string; start: number; sub: number; marks: number[]; faded: number | null; picking: boolean; draft: number | null;
  guideLift?: number; guide: boolean; running: boolean; speed: number; display: DisplayPreferences; paint: Paint; disabled: boolean;
  focus: { offset: number; token: number } | null;
  onPosition: (offset: number) => void;
  onPages: (count: number) => void; onReflow: (page: number) => void; onVisible: (offset: number) => void;
  onNext: () => void; onPrev: () => void; onAdvance: () => void; onPause: () => void;
  onToggleGuide?: () => void;
  onFinish?: () => void;
  onOpenReview?: () => void;
  bookTitle?: string;
  onPick: (offset: number) => void; onMarkPress: (offset: number) => void;
  onDragStart: (offset: number) => void; onDrop: (from: number, to: number | null) => void;
  headerDrag: { token: number; x: number; y: number; phase: 'move' | 'end' | 'cancel' } | null;
  onHeaderDrop: (token: number, offset: number | null) => void;
  dom?: import('expo/dom').DOMProps;
};
type Gesture = { id: number; x: number; y: number; from: number | null; dragged: boolean; placing: boolean; scroll: number; mouse: boolean; continuous: boolean };
function Ribbon() { return <svg width="18" height="28" viewBox="0 0 18 28" aria-hidden="true"><path d="M1 1h16v25l-8-6-8 6z" fill="currentColor" /></svg>; }

export default function VerticalPage(props: Props) {
  const { guideLift = 1, text, start, sub, marks, faded, picking, draft, guide, running, speed, display, paint, disabled, focus } = props;
  const rootRef = useRef<HTMLDivElement>(null), viewRef = useRef<HTMLDivElement>(null), textRef = useRef<HTMLDivElement>(null), measureRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observedPage = useRef(-1);
  const autoScroll = useRef(false), scrollFrame = useRef<number | null>(null);
  const wasRunning = useRef(false);
  const guideStartScroll = useRef(0);
  const guideTravel = useRef<number | null>(null);
  const guideAdvanced = useRef(-1);
  const [waveRange, setWaveRange] = useState({ first: 0, last: 0 });
  const guideMetrics = useRef<{ rows: { distance: number; indices: number[] }[]; spacing: number; capacity: number } | null>(null);
  const wheelLock = useRef(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (wheelTimer.current) clearTimeout(wheelTimer.current); }, []);
  const latest = useRef(props); latest.current = props;
  useEffect(() => bindGuideKeyboard(document, () => latest.current.disabled || latest.current.picking ? undefined : latest.current.onToggleGuide), []);
  const [layout, setLayout] = useState({ count: 1, width: 0, viewport: 0, starts: [0, 0] });
  const [guideCursor, setGuideCursor] = useState({ page: 0, index: 0 });
  const gesture = useRef<Gesture | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [edge, setEdge] = useState<'next' | 'prev' | null>(null);
  const anchor = useRef({ text, start, offset: start });
  const measured = useRef('');
  const measuring = useRef(''), measurement = useRef(0);
  const fontRevision = useRef(0);
  const [calculating, setCalculating] = useState(false);
  const focusSeen = useRef<number | null>(null);
  const headerDropSeen = useRef<number | null>(null);
  const step = Math.round(display.fontSize * display.lineHeight);
  const page = Math.min(Math.max(0, sub), props.onFinish ? layout.count : layout.count - 1);
  const cursor = guideCursor.page === page ? guideCursor.index : 0;
  function setCursor(index: number) { setGuideCursor({ page, index }); }
  const begin = layout.starts[page] ?? 0, end = layout.starts[page + 1] ?? text.length;
  const chars = useMemo(() => {
    if (!layout.width) return [];
    let position = start + begin;
    return Array.from(text.slice(begin, end)).map(char => { const begin = position; position += char.length; return { char, begin, end: position }; });
  }, [text, start, begin, end, layout.width]);

  const measure = useCallback(() => {
    const view = viewRef.current, body = measureRef.current;
    if (!view || !body || !view.clientWidth || !view.clientHeight) return;
    const perPage = Math.max(1, Math.floor((view.clientWidth - 32) / step));
    const width = perPage * step;
    const signature = `${text}:${start}:${width}:${view.clientWidth}:${view.clientHeight}:${display.font}:${display.fontSize}:${step}:${fontRevision.current}`;
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
      observedPage.current = -1;
      setLayout({ count, width, viewport: view.clientWidth, starts });
      latest.current.onPages(count);
      // 設定や画面幅が変わっても、読んでいた文字のあるページを残す。
      if (sameText && anchor.current.offset < start + text.length) latest.current.onReflow(pageAtOffset(starts, anchor.current.offset - start));
    }).catch(() => {
      if (measurement.current === job) latest.current.onLoadError?.('本文のページを準備できませんでした。もう一度お試しください。');
    }).finally(() => { if (measurement.current === job) { measuring.current = ''; setCalculating(false); } });
  }, [text, start, step, display.font, display.fontSize]);
  useLayoutEffect(() => {
    // iPhone では内部のWebViewの中で描かれ、そのページの高さが0のままだと紙面が潰れる。
    // WebViewの中にいるときだけ、ページ全体の高さを画面いっぱいにする（Webでは親の高さに従う）。
    if ((window as any).ReactNativeWebView) {
      for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
        if (el) { el.style.height = '100%'; el.style.margin = '0'; el.style.overflow = 'hidden'; el.style.overscrollBehavior = 'none'; }
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
    if (page < layout.count) latest.current.onVisible(offset);
  }, [page, layout, text, start]);
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !layout.viewport || observedPage.current === page) return;
    observedPage.current = page;
    // ガイドのページ更新では先頭へ飛ばさず、文字位置への追従を続ける。
    if (guide && running) return;
    stopScroll();
    scroll.scrollTo({ left: -page * layout.viewport, behavior: 'instant' as ScrollBehavior });
  }, [page, layout]);
  useLayoutEffect(() => {
    if (!guide || !running) scrollRef.current?.scrollTo({ left: -page * layout.viewport, behavior: 'instant' as ScrollBehavior });
  }, [guide, running, page, layout.viewport]);
  function stopScroll() {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    autoScroll.current = false;
  }
  // 停止後の開始は現在ページの右上から。ページをまたぐ自動送りではリセットしない。
  useLayoutEffect(() => {
    if (guide && running && !wasRunning.current) {
      setCursor(0);
      guideStartScroll.current = -page * layout.viewport;
      scrollRef.current?.scrollTo({ left: guideStartScroll.current, behavior: 'instant' as ScrollBehavior });
      guideTravel.current = null; guideAdvanced.current = -1;
    }
    wasRunning.current = guide && running;
  }, [guide, running, page, layout.viewport]);
  // 実測した列の位置を使い、空いた行間も実際の距離として扱う。
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const first = chars[0] && textRef.current?.querySelector<HTMLElement>(`[data-i][data-offset="${chars[0].end}"]`);
    const container = first?.parentElement;
    if (!scroll || !container) { guideMetrics.current = null; return; }
    const spacing = layout.viewport / Math.max(1, Math.round(layout.width / step));
    const origin = scroll.getBoundingClientRect().right - container.getBoundingClientRect().left - scroll.scrollLeft;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-i]'));
    const rows: { distance: number; indices: number[] }[] = [];
    for (const node of nodes) {
      const index = Number(node.dataset.i);
      if (chars[index]?.char === '\n' || !node.offsetWidth) continue;
      const distance = origin - node.offsetLeft - node.offsetWidth / 2;
      const row = rows.find(row => Math.abs(row.distance - distance) < 1);
      if (row) row.indices.push(index); else rows.push({ distance, indices: [index] });
    }
    rows.sort((a, b) => a.distance - b.distance);
    guideMetrics.current = { rows, spacing, capacity: Math.max(1, Math.floor(container.clientHeight / display.fontSize)) };
  }, [chars, layout, display.font, display.fontSize, step]);
  useEffect(() => {
    if (!guide || !running || picking || ghost || props.headerDrag || disabled || calculating || !layout.viewport) { stopScroll(); return; }
    const scroll = scrollRef.current;
    if (!scroll) return;
    let previous = performance.now();
    autoScroll.current = true;
    const frame = (now: number) => {
      const metrics = guideMetrics.current;
      if (metrics?.rows.length) {
        if (guideTravel.current === null) guideTravel.current = metrics.rows[0].distance - metrics.spacing / 2;
        // 読む速さ・一列の文字数・実際の行間から速度を決める。短い行や空行では加速しない。
        const velocity = metrics.spacing * latest.current.speed / (60000 * metrics.capacity);
        guideTravel.current += Math.max(0, now - previous) * velocity;
        const wave = guideRowWave(metrics.rows, guideTravel.current, metrics.spacing);
        if (wave) {
          setGuideCursor(before => before.page === page && before.index === wave.index ? before : { page, index: wave.index });
          setWaveRange(before => before.first === wave.first && before.last === wave.last ? before : { first: wave.first, last: wave.last });
        } else setWaveRange(before => before.first === -1 ? before : { first: -1, last: -1 });
        const target = Math.min(guideStartScroll.current, guideScrollLeft(0, 0, -guideTravel.current, layout.viewport, scroll.scrollWidth));
        if (Math.abs(scroll.scrollLeft - target) > .1) scroll.scrollLeft = target;
        if (guideTravel.current >= metrics.rows[metrics.rows.length - 1].distance + metrics.spacing / 2 && guideAdvanced.current !== page) {
          guideAdvanced.current = page; latest.current.onAdvance();
        }
      }
      previous = now;
      scrollFrame.current = requestAnimationFrame(frame);
    };
    scrollFrame.current = requestAnimationFrame(frame);
    return stopScroll;
  }, [guide, running, page, layout, picking, ghost, props.headerDrag, disabled, calculating]);
  function finishReading() {
    observedPage.current = layout.count;
    latest.current.onPause(); latest.current.onFinish?.();
  }
  function onScroll() {
    const scroll = scrollRef.current;
    if (!scroll || !layout.viewport || autoScroll.current) return;
    if (latest.current.onFinish && !picking && !disabled && reachedEnding(scroll.scrollLeft, layout.viewport, layout.count)) { finishReading(); return; }
    const visible = visibleScrollPage(scroll.scrollLeft, layout.viewport, layout.count);
    if (observedPage.current !== visible) {
      observedPage.current = visible;
      latest.current.onPause();
      latest.current.onReflow(visible);
    }
  }
  useEffect(() => {
    if (!focus || focusSeen.current === focus.token || !layout.width || focus.offset < start || focus.offset > start + text.length) return;
    focusSeen.current = focus.token;
    const target = pageAtOffset(layout.starts, focus.offset - start);
    scrollRef.current?.scrollTo({ left: -target * layout.viewport, behavior: 'instant' as ScrollBehavior });
    latest.current.onReflow(target);
  }, [focus, layout, start, text]);
  useEffect(() => {
    if (disabled || calculating || !layout.width || !focus || page !== pageAtOffset(layout.starts, focus.offset - start)) return;
    // 非表示のiOS WebViewは描画フレームが来ない場合がある。
    // 実測ページと保存位置の反映を完了条件にし、描画フレームは待たない。
    const timer = setTimeout(() => latest.current.onReady?.(), 0);
    return () => clearTimeout(timer);
  }, [disabled, calculating, layout, focus, page, start]);
  useEffect(() => {
    const pause = () => { if (document.hidden) latest.current.onPause(); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (!edge || !ghost) return;
    // 方向が同じ間は待機を作り直さない。指の小さな揺れでも端送りを続ける。
    const timer = setInterval(() => { if (gesture.current?.dragged || gesture.current?.placing || latest.current.headerDrag?.phase === 'move') edge === 'next' ? latest.current.onNext() : latest.current.onPrev(); }, 650);
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
      if (rect.right <= root.left || rect.left >= root.right) return;
      const d = Math.hypot(x - (rect.left + rect.right) / 2, y - (rect.top + rect.bottom) / 2);
      if (d < distance) { best = Number(node.dataset.offset); distance = d; }
    });
    return best;
  }
  function movePoint(x: number, y: number) {
    const offset = pointOffset(x, y);
    const character = offset === null ? null : textRef.current?.querySelector<HTMLElement>(`[data-i][data-offset="${offset}"]`);
    const rect = character?.getBoundingClientRect();
    setGhost(rect ? { x: rect.left + rect.width / 2, y: rect.bottom - 10 } : { x, y });
    const root = rootRef.current?.getBoundingClientRect();
    setEdge(root && y >= root.top && y <= root.bottom ? edgeTurn(x, root.left, root.width) : null);
  }
  useLayoutEffect(() => {
    const drag = props.headerDrag;
    if (!drag) { if (!gesture.current) { setGhost(null); setEdge(null); } return; }
    if (headerDropSeen.current === drag.token) return;
    const root = rootRef.current?.getBoundingClientRect();
    const x = root ? root.left + drag.x * root.width : 0, y = root ? root.top + drag.y * root.height : 0;
    if (drag.phase === 'move') { if (root && !disabled && !calculating) movePoint(x, y); return; }
    headerDropSeen.current = drag.token; setGhost(null); setEdge(null);
    latest.current.onHeaderDrop(drag.token, drag.phase === 'end' && root && !disabled && !calculating ? pointOffset(x, y) : null);
  }, [props.headerDrag, disabled, calculating, page, layout]);
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // 自動送り中は本文操作で停止・ページ移動しない。停止はツールバーから行う。
    if (guide && running) { event.preventDefault(); return; }
    if (disabled || calculating || props.headerDrag || !event.isPrimary || event.button !== 0 || gesture.current) return;
    if (event.target instanceof Element && event.target.closest('button,a,input,textarea,select')) return;
    stopScroll(); autoScroll.current = false;
    let target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mark]') : null;
    if (!target && !picking) {
      let nearest = 18;
      rootRef.current?.querySelectorAll<HTMLElement>('[data-mark]').forEach(node => {
        const rect = node.getBoundingClientRect();
        const distance = Math.hypot(Math.max(rect.left - event.clientX, 0, event.clientX - rect.right), Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom));
        if (distance < nearest) { nearest = distance; target = node; }
      });
    }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, from: target ? Number(target.dataset.mark) : null, dragged: false, placing: picking, scroll: scrollRef.current?.scrollLeft ?? 0, mouse: event.pointerType === 'mouse', continuous: guide && running };
    if (target || picking) event.preventDefault();
    latest.current.onPause();
    if (target || picking || event.pointerType === 'mouse' || !(guide && running)) event.currentTarget.setPointerCapture(event.pointerId);
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
    else if (current.continuous && current.mouse && current.from === null && scrollRef.current) scrollRef.current.scrollLeft = current.scroll - (event.clientX - current.x);
  }
  function finish(event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null; setGhost(null); setEdge(null);
    if (rootRef.current?.hasPointerCapture(event.pointerId)) rootRef.current.releasePointerCapture(event.pointerId);
    if (current.dragged && current.from !== null) { latest.current.onDrop(current.from, cancelled ? null : pointOffset(event.clientX, event.clientY)); return; }
    if (cancelled) return;
    if (current.placing) { const offset = pointOffset(event.clientX, event.clientY); if (offset !== null) latest.current.onPick(offset); return; }
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (current.from !== null) { if (Math.hypot(dx, dy) <= 12) latest.current.onMarkPress(current.from); return; }
    if (!current.continuous) {
      const direction = horizontalTurn(dx, dy);
      if (direction === 'next') latest.current.onNext();
      else if (direction === 'prev') latest.current.onPrev();
      else if (current.mouse && Math.hypot(dx, dy) <= 12) {
        const bounds = rootRef.current?.getBoundingClientRect();
        if (bounds) event.clientX < bounds.left + bounds.width / 2 ? latest.current.onNext() : latest.current.onPrev();
      }
    }
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
      onKeyDown={event => { if (guide && running) return; if (event.key === 'Enter' && marked && !picking) latest.current.onMarkPress(offset); }}
      style={{ ...styles.ribbon, ...(first ? { top: 0, right: 0, left: 'auto' } : {}), color: paint.accent, opacity: marked && (faded === offset || (ghost && gesture.current?.from === offset)) ? 0.25 : 1 }}><span style={{ pointerEvents: 'none', display: 'block' }}><Ribbon /></span></span>;
  }
  return <div ref={rootRef} style={{ ...styles.root, background: paint.background, touchAction: 'none', cursor: ghost ? 'grabbing' : undefined }} onDragStart={event => event.preventDefault()} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}>
    {calculating && <div role="status" style={{ position: 'absolute', top: 4, left: 24, color: paint.muted, fontSize: 12, pointerEvents: 'none' }}>ページを整えています…</div>}
    <div ref={viewRef} style={styles.view}>
      <div ref={measureRef} aria-hidden="true" style={{ ...styles.text, visibility: 'hidden', pointerEvents: 'none', fontFamily: fontFamilies[display.font], fontSize: display.fontSize, lineHeight: `${step}px` }}>{text}</div>
      <div ref={scrollRef} role="region" aria-label="本文・横スクロール" tabIndex={0} onScroll={onScroll}
        onWheel={event => {
          if (guide && running) { event.preventDefault(); return; }
          if (picking || disabled || !scrollRef.current) return;
          if (!guide || !running) {
            if (wheelLock.current || Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY)) < 4) return;
            wheelLock.current = true; wheelTimer.current = setTimeout(() => { wheelLock.current = false; }, 240);
            (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX < 0 : event.deltaY > 0) ? latest.current.onNext() : latest.current.onPrev(); return;
          }
          stopScroll(); autoScroll.current = false; latest.current.onPause();
        }}
        onKeyDown={event => {
          if (guide && running && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); return; }
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || disabled || picking) return;
          event.preventDefault(); stopScroll(); latest.current.onPause();
          if (event.key === 'ArrowLeft') latest.current.onNext();
          else if (event.key === 'ArrowRight') latest.current.onPrev();
          else if (event.key === 'Home') latest.current.onReflow(0);
          else if (latest.current.onFinish) latest.current.onFinish(); else latest.current.onReflow(layout.count - 1);
        }}
        style={{ ...styles.scroll, overflowX: 'hidden', touchAction: 'none' }}>
        <div ref={textRef} style={styles.track}>
          {Array.from({ length: layout.count }, (_, sheet) => {
            let position = start + (layout.starts[sheet] ?? 0);
            const sheetChars = Math.abs(sheet - page) <= 2 ? Array.from(text.slice(layout.starts[sheet], layout.starts[sheet + 1])).map(char => { const begin = position; position += char.length; return { char, begin, end: position }; }) : [];
            return <div key={sheet} aria-label={`${sheet + 1}ページ`} style={{ ...styles.sheet, width: layout.viewport || '100%', borderLeft: 'none' }}>
              <div style={{ ...styles.clip, width: layout.viewport || '100%' }}><div style={{ ...styles.text, color: paint.ink, fontFamily: fontFamilies[display.font], fontSize: display.fontSize, lineHeight: `${layout.viewport / Math.max(1, Math.round(layout.width / step)) || step}px` }}>
      {sheet === 0 && ribbon(start, true)}{sheetChars.map(({ char, end }, index) => <span key={end} data-i={index} data-offset={end} style={{ position: 'relative', display: char === '\n' ? 'inline' : 'inline-block', opacity: guide && running ? guideOpacity(index, cursor, sheet === page && index >= waveRange.first && index <= waveRange.last) : 1, fontWeight: 400, transform: guide && running && sheet === page && index >= waveRange.first && index <= waveRange.last ? `scaleY(${1 + Math.max(0, 1 - Math.abs(index - cursor) / 5) * 0.09 * guideLift})` : undefined, textShadow: guide && running && sheet === page && index >= waveRange.first && index <= waveRange.last && Math.abs(index - cursor) < 4 ? `0 1px 1px color-mix(in srgb, ${paint.muted} 20%, transparent)` : undefined, transition: 'opacity 100ms ease, transform 100ms ease, text-shadow 100ms ease', background: !ghost && picking && draft === end ? paint.chosen : undefined }}>{char}{ribbon(end)}</span>)}
              </div></div>
            </div>;
          })}
          {props.onFinish && <div aria-label="読了ページ" style={{ ...styles.sheet, width: layout.viewport || '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center', background: paint.background, color: paint.ink }}>
            <span style={{ color: paint.accent, fontSize: 13, letterSpacing: '.15em' }}>おわり</span>
            <h2 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}>読了しました</h2>
            <p style={{ margin: 0, fontSize: 14, color: paint.muted }}>『{props.bookTitle ?? ''}』</p>
            <button onClick={() => latest.current.onOpenReview?.()} style={{ border: 'none', borderRadius: 16, padding: '14px 24px', background: paint.chosen, color: paint.ink, font: 'inherit', cursor: 'pointer' }}>感想を書く</button>
          </div>}
        </div>
      </div>
    </div>
    {!picking && !ghost && <>
      {page < layout.count - 1 && <span aria-hidden="true" style={{ ...styles.turnHint, left: 4, color: paint.ink }}>←</span>}
      {page > 0 && <span aria-hidden="true" style={{ ...styles.turnHint, right: 4, color: paint.ink }}>→</span>}
    </>}
    {ghost && !props.headerDrag && <span aria-hidden="true" style={{ position: 'fixed', pointerEvents: 'none', left: ghost.x - 9, top: ghost.y - 5, zIndex: 9999, color: paint.accent, transform: 'scale(1.18) rotate(-5deg)', transformOrigin: 'center top', filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.20))' }}><Ribbon /></span>}
    {ghost && edge && <span aria-hidden="true" style={{ position: 'absolute', bottom: 8, left: edge === 'next' ? 8 : undefined, right: edge === 'prev' ? 8 : undefined, color: paint.ink, background: paint.background, pointerEvents: 'none', padding: 6 }}>{edge === 'next' ? '‹ 次のページへ' : '前のページへ ›'}</span>}
  </div>;
}
const styles: Record<string, React.CSSProperties> = {
  root: { height: '100%', width: '100%', padding: '24px 24px', boxSizing: 'border-box', userSelect: 'none', touchAction: 'pan-x', position: 'relative', overflow: 'hidden', overscrollBehavior: 'none' },
  turnHint: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: 22, opacity: 0.16, pointerEvents: 'none', lineHeight: 1 },
  view: { height: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', minHeight: 0, overflow: 'hidden' },
  scroll: { position: 'absolute', inset: 0, direction: 'rtl', overflowY: 'hidden', overscrollBehaviorX: 'contain', scrollbarWidth: 'none', touchAction: 'pan-x' },
  track: { display: 'flex', width: 'max-content', height: '100%', direction: 'rtl' },
  sheet: { flexShrink: 0, height: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'center', position: 'relative', direction: 'ltr' },
  clip: { position: 'relative', height: '100%', overflow: 'hidden' },
  text: { position: 'absolute', top: 0, right: 0, height: '100%', width: 'max-content', writingMode: 'vertical-rl', letterSpacing: '0.05em', whiteSpace: 'pre-wrap' },
  // 印のために行が伸びないよう、文字の上へ重ねる。
  ribbon: { position: 'absolute', top: '100%', left: '50%', width: 30, height: 38, padding: '5px 6px', boxSizing: 'border-box', transform: 'translate(-50%, -24px)', zIndex: 20, cursor: 'grab', touchAction: 'none', lineHeight: 0 },
};
