'use dom';


import { missingMathBars, repairMathText } from './math-text.mjs';
import { pdfCharacter, type PdfMark } from './bookmarks.mjs';
import * as pdfjs from 'pdfjs-dist';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { horizontalTurn } from '@/features/reader/gestures.mjs';
import { pdfSource } from './source.mjs';
import type { ReadLocalPdf } from './source.mjs';

// iOSではWebView内でPDFを描画する。画面付近だけ描き、離れたページのCanvasは解放する。
const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`;
pdfjs.GlobalWorkerOptions.workerSrc = `${cdn}/build/pdf.worker.min.mjs`;

type Props = { viewportSize?: { width: number; height: number }; marks?: PdfMark[]; picking?: boolean; onPick?: (mark: Omit<PdfMark, 'id'>) => void; onDocument?: (source: string) => void; uri: string; readLocalPdf?: ReadLocalPdf; initialPage?: number; zoom?: number; spread?: boolean; onPosition?: (page: number, total: number) => void; pageRequest?: { page: number; token: number } | null; onReady?: () => void; onLoadError?: (message: string) => void; dom?: import('expo/dom').DOMProps };

function PdfPage({ doc, number, width, height, root, onRendered, onLoadError, marks = [], picking = false, onPick }: { marks?: PdfMark[]; picking?: boolean; onPick?: Props['onPick']; doc: pdfjs.PDFDocumentProxy; number: number; width: number; height: number; root: HTMLDivElement | null; onRendered: (page: number) => void; onLoadError?: (message: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null), textDivs = useRef<HTMLElement[]>([]);
  const [textReady, setTextReady] = useState(0);
  const [pins, setPins] = useState<{ id: string; left: number; top: number }[]>([]);
  useEffect(() => {
    const layer = textLayerRef.current; if (!layer) return;
    const next: typeof pins = [];
    for (const mark of marks.filter(mark => mark.page === number && mark.source === doc.fingerprints[0] && mark.offset !== null)) {
      let at = mark.offset!;
      for (const span of textDivs.current) { const text = span.textContent ?? ''; if (at >= text.length) { at -= text.length; continue; }
        const character = pdfCharacter(text, at); const node = span.firstChild;
        if (character && node) { const range = document.createRange(); range.setStart(node, character.offset); range.setEnd(node, character.offset + character.length); const rect = range.getBoundingClientRect(), base = slot.current!.getBoundingClientRect(); next.push({ id: mark.id, left: rect.left - base.left, top: rect.top - base.top }); } break;
      }
    }
    setPins(next);
  }, [marks, textReady, width, height, number, doc]);
  function pick(event: React.MouseEvent<HTMLDivElement>) {
    if (!picking || !onPick) return;
    event.stopPropagation();
    const hit = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const range = !hit ? (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(event.clientX, event.clientY) : null;
    const node = hit?.offsetNode ?? range?.startContainer, offset = hit?.offset ?? range?.startOffset;
    if (!node || offset === undefined) return;
    const spans = textDivs.current; const index = spans.findIndex(span => span.contains(node)); if (index < 0) return;
    const text = spans[index].textContent ?? ''; const character = pdfCharacter(text, Math.min(offset, text.length - 1)); if (!character || !character.quote.trim()) return;
    const rect = spans[index].getBoundingClientRect(); if (event.clientX < rect.left - 2 || event.clientX > rect.right + 2 || event.clientY < rect.top - 2 || event.clientY > rect.bottom + 2) return;
    onPick({ source: doc.fingerprints[0] ?? '', page: number, offset: spans.slice(0, index).reduce((total, span) => total + (span.textContent?.length ?? 0), 0) + character.offset, quote: character.quote });
  }

  const [nearby, setNearby] = useState(false);
  const [error, setError] = useState(false);
  const callbacks = useRef({ onRendered, onLoadError }); callbacks.current = { onRendered, onLoadError };
  useEffect(() => {
    if (!root || !slot.current) return;
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { root, rootMargin: '250px 0px' });
    observer.observe(slot.current);
    return () => observer.disconnect();
  }, [root]);
  useEffect(() => {
    // 大きさがまだ決まっていない（開いた直後は高さが0のことがある）うちは描かない
    if (!nearby || !canvas.current || width < 40 || height < 40) return;
    const target = canvas.current;
    let cancelled = false, painted = false;
    let task: pdfjs.RenderTask | undefined;
    let textTask: pdfjs.TextLayer | undefined;
    setError(false);
    void doc.getPage(number).then(async page => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(width / base.width, height / base.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * ratio });
      target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
      target.style.width = `${viewport.width / ratio}px`; target.style.height = `${viewport.height / ratio}px`;
      task = page.render({ canvas: target, viewport });
      // 読める紙面が描けたら表示する。文字認識用レイヤーの準備で読書を塞がない。
      void task.promise.then(() => { painted = true; if (!cancelled) { setError(false); callbacks.current.onRendered(number); } }).catch(() => {});
      const layer = textLayerRef.current!; layer.replaceChildren();
      const cssViewport = page.getViewport({ scale });
      layer.style.setProperty('--total-scale-factor', String(scale));
      const [content, operators] = await Promise.all([page.getTextContent(), page.getOperatorList(), task.promise]);
      if (cancelled) return;
      const fonts: Record<string, string> = {};
      for (const item of content.items) if ('fontName' in item) fonts[item.fontName] = page.commonObjs.get(item.fontName)?.name ?? '';
      const corrected = repairMathText(content, fonts, missingMathBars(operators, pdfjs.OPS, fonts));
      textTask = new pdfjs.TextLayer({ textContentSource: corrected, container: layer, viewport: cssViewport });
      const drawing = task.promise;
      return Promise.all([drawing, textTask.render().then(() => { if (!cancelled) { textDivs.current = textTask!.textDivs; setTextReady(value => value + 1); } }).catch(() => { /* 画像だけのページでもPDF表示とページ単位のしおりは使える。 */ })]);
    })
      .catch(reason => { if (!cancelled && (reason as Error)?.name !== 'RenderingCancelledException') { if (painted) { /* 文字認識だけの失敗では、描画済みの紙面を隠さない。 */ return; } setError(true); callbacks.current.onLoadError?.('PDFのページを表示できませんでした。もう一度お試しください。'); } });
    // 中断後のCanvasを再利用しないよう、画面外では要素ごと外す。
    return () => { cancelled = true; task?.cancel(); textTask?.cancel(); };
  }, [doc, number, width, height, nearby]);
  return <div ref={slot} aria-label={`${number}ページ`} style={{ ...styles.page, width, height }}>
    <style>{`.pdf-book-text{position:absolute;inset:0;overflow:clip;line-height:1;text-align:initial;letter-spacing:normal;word-spacing:normal;text-size-adjust:none;transform-origin:0 0;--min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));--min-font-size-inv:calc(1 / var(--min-font-size));}.pdf-book-text :is(span,br){color:transparent;position:absolute;white-space:pre;transform-origin:0 0;user-select:text;cursor:crosshair;}.pdf-book-text > :not(.markedContent),.pdf-book-text .markedContent span:not(.markedContent){--font-height:0;font-size:calc(var(--text-scale-factor) * var(--font-height));--scale-x:1;--rotate:0deg;transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));}.pdf-book-text .markedContent{display:contents;}`}</style>
    {nearby && <canvas key={`${width}:${height}`} ref={canvas} style={{ display: 'block', maxWidth: '100%' }} />}
    <div ref={textLayerRef} className="pdf-book-text" onClick={pick} style={{ pointerEvents: picking ? 'auto' : 'none', touchAction: picking ? 'none' : undefined }} />
    {pins.map(pin => <span key={pin.id} aria-label="文字のしおり" style={{ position: 'absolute', left: pin.left, top: pin.top - 13, width: 10, height: 16, background: '#386149', clipPath: 'polygon(0 0,100% 0,100% 100%,50% 75%,0 100%)', pointerEvents: 'none' }} />)}
    {error && <p role="alert" style={styles.pageMessage}>表示できません。ページを画面外へスクロールしてから戻すか、教材を開き直してください。</p>}
    <span style={styles.pageNumber}>{number}</span>
  </div>;
}

export default function PdfBook({ viewportSize, uri, readLocalPdf, initialPage = 1, zoom = 1, spread = false, onReady, onLoadError, onPosition, pageRequest, marks = [], picking = false, onPick, onDocument }: Props) {
  const callbacks = useRef({ onReady, onLoadError, onPosition, readLocalPdf, onDocument }); callbacks.current = { onReady, onLoadError, onPosition, readLocalPdf, onDocument };
  const rootRef = useRef<HTMLDivElement>(null);
  const readySent = useRef(false); // 「準備できた」は最初の1回だけ親へ知らせる（何度も知らせると描き直しが繰り返される）
  const stageRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const position = useRef(initialPage);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [paper, setPaper] = useState({ width: 595, height: 842 });
  const [error, setError] = useState('');
  const frame = useRef<number | null>(null);
  const step = spread ? 2 : 1;
  const total = doc?.numPages ?? 0;
  // 紙面の縦横比を保ち、表示領域のどちらかの辺に接する最大倍率にする。
  const fitWidth = Math.max(1, size.width - (spread ? 2 : 0)) / step / paper.width;
  const scale = Math.min(fitWidth, Math.max(1, size.height) / paper.height) * (spread ? Math.min(1, zoom) : zoom);
  const pageWidth = paper.width * scale, pageHeight = paper.height * scale;

  useLayoutEffect(() => {
    const host = (window as any).$$EXPO_DOM_HOST_OS;
    const native = host === 'ios' || host === 'android' || !!(window as any).ReactNativeWebView;
    if (native) {
      for (const element of [document.documentElement, document.body, document.getElementById('root')]) {
        if (element) { element.style.height = '100%'; element.style.margin = '0'; }
      }
    }
    const fit = () => {
      if (!rootRef.current || (!native && !viewportSize)) return;
      rootRef.current.style.height = `${viewportSize?.height ?? window.innerHeight}px`;
      if (viewportSize) rootRef.current.style.width = `${viewportSize.width}px`;
    };
    fit();
    window.addEventListener('resize', fit);

    const stage = stageRef.current!;
    const observer = new ResizeObserver(() => setSize({ width: stage.clientWidth, height: stage.clientHeight }));
    observer.observe(stage);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [viewportSize?.width, viewportSize?.height]);

  useEffect(() => {
    let cancelled = false;
    setDoc(null); setError('');
    let task: pdfjs.PDFDocumentLoadingTask | undefined;
    // Expo DOMの関数プロキシはprops受信のたびに変わる。ページ通知でPDFを破棄・再取得しない。
    const read = callbacks.current.readLocalPdf ? (offset: number, length: number) => callbacks.current.readLocalPdf!(offset, length) : undefined;
    void pdfSource(uri, read, () => cancelled).then(source => {
      if (cancelled) return;
      task = pdfjs.getDocument({ ...source, cMapUrl: `${cdn}/cmaps/`, cMapPacked: true, fontExtraProperties: true, standardFontDataUrl: `${cdn}/standard_fonts/` });
      return task.promise;
    }).then(async pdf => {
      if (!pdf || cancelled) return;
      const first = await pdf.getPage(1);
      if (cancelled) return;
      const viewport = first.getViewport({ scale: 1 });
      setPaper({ width: viewport.width, height: viewport.height }); setDoc(pdf); callbacks.current.onDocument?.(pdf.fingerprints[0] ?? '');
    }).catch(reason => { if (!cancelled) { const message = reason instanceof Error && reason.message.startsWith('LOCAL_PDF_') ? '端末内のPDFを読み込めませんでした。教材を開き直してください。' : '教材を開けませんでした。通信を確認して、もう一度お試しください。'; setError(message); callbacks.current.onLoadError?.(message); } });
    return () => { cancelled = true; void task?.destroy(); };
  }, [uri]);

  useEffect(() => { if (pageRequest) jump(pageRequest.page); }, [pageRequest]);
  useEffect(() => { callbacks.current.onPosition?.(page, total); }, [page, total]);

  function jump(number: number) {
    const target = Math.max(1, Math.min(total || 1, number));
    const start = target - ((target - 1) % step);
    if (stageRef.current) { stageRef.current.scrollTop = 0; stageRef.current.scrollLeft = 0; }
    position.current = start; setPage(start);
  }
  useEffect(() => { position.current = initialPage; jump(initialPage); }, [initialPage, doc]);
  // 倍率・表示方式の変更では、読んでいたページへ戻して読書位置を保つ。
  useEffect(() => { if (doc) jump(position.current); }, [zoom, spread, size, doc]);

  return <div ref={rootRef} style={styles.root}>
    <div ref={stageRef} style={{ ...styles.stage, overflow: !spread && zoom > 1 ? 'auto' : 'hidden', touchAction: spread ? 'none' : 'pan-y' }}
      onPointerDown={event => { if (!picking && !spread && event.isPrimary && event.button === 0) swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
      onPointerCancel={() => { swipe.current = null; }}
      onPointerUp={event => { const from = swipe.current; swipe.current = null; if (!from || from.id !== event.pointerId || !doc) return; const turn = horizontalTurn(event.clientX - from.x, event.clientY - from.y); if (turn) jump(page + (turn === 'prev' ? 1 : -1)); }}
      tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); jump(page + (event.key === 'ArrowRight' ? step : -step)); } }}
      onClick={event => { if (picking || !spread || !doc) return; const bounds = event.currentTarget.getBoundingClientRect(); jump(page + (event.clientX - bounds.left < bounds.width / 2 ? -2 : 2)); }} aria-label={spread ? '原文PDF・左を押すと前、右を押すと次の見開き' : '原文PDF・左へスワイプで次のページ、右へスワイプで前のページ'}>
      {error ? <p role="alert" style={styles.message}>{error}</p> : !doc ? <p role="status" style={styles.message}>教材を読み込んでいます…</p> : size.width > 0 && size.height > 0 && <div style={{ ...styles.paperList, height: '100%', justifyContent: zoom > 1 ? 'flex-start' : 'center', padding: 0, gap: 0 }}>
        {Array.from({ length: Math.ceil(total / step) }, (_, index) => {
          const start = index * step + 1;
          if (start !== page) return null;
          return <div key={start} data-page={start} style={{ ...styles.paperRow, gap: spread ? 2 : 0 }}>
            {Array.from({ length: Math.min(step, total - start + 1) }, (_, offset) => <PdfPage marks={marks} picking={picking} onPick={onPick} key={`${uri}:${start + offset}`} doc={doc} number={start + offset} width={pageWidth} height={pageHeight} root={stageRef.current}
              onRendered={() => { if (!readySent.current && callbacks.current.onReady) { void Promise.resolve(callbacks.current.onReady()).then(() => { readySent.current = true; }).catch(() => { callbacks.current.onLoadError?.('表示完了を通知できませんでした。教材を閉じて、もう一度開いてください。'); }); } }} onLoadError={onLoadError} />)}
          </div>;
        })}
      </div>}
    </div>

  </div>;
}

const styles: Record<string, React.CSSProperties> = {
  root: { position: 'absolute', inset: 0, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, background: '#F6F2E9', fontFamily: 'system-ui, sans-serif' },
  stage: { position: 'relative', width: '100%', minWidth: 0, flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain', overflowAnchor: 'none' },
  paperList: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, width: 'max-content', minWidth: '100%', boxSizing: 'border-box', padding: 0 },
  paperRow: { display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'flex-start', scrollMarginTop: 16 },
  page: { position: 'relative', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' },
  pageNumber: { position: 'absolute', bottom: 3, right: 6, color: '#73776E', fontSize: 10 },
  pageMessage: { position: 'absolute', padding: 16, fontSize: 13, color: '#73776E' },
  message: { color: '#73776E', fontSize: 13, padding: 16 },
  bar: { flex: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 10, borderTop: '1px solid #DEDFD4' },
  button: { font: 'inherit', fontSize: 13, padding: '8px 12px', borderRadius: 10, border: 'none', background: '#FFFDF8', color: '#386149', cursor: 'pointer' },
  count: { fontSize: 12, color: '#73776E', minWidth: 80, textAlign: 'center' },
  seek: { flex: 1, minWidth: 40, maxWidth: 520, accentColor: '#386149' },
};
