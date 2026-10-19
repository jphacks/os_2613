'use dom';

import * as pdfjs from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import { horizontalTurn } from '@/features/reader/gestures.mjs';
import { pdfSource } from './source.mjs';
import type { ReadLocalPdf } from './source.mjs';

// iOSではWebView内でPDFを描画する。画面付近だけ描き、離れたページのCanvasは解放する。
const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`;
pdfjs.GlobalWorkerOptions.workerSrc = `${cdn}/build/pdf.worker.min.mjs`;

type Props = { uri: string; readLocalPdf?: ReadLocalPdf; initialPage?: number; zoom?: number; spread?: boolean; onPosition?: (page: number, total: number) => void; pageRequest?: { page: number; token: number } | null; onReady?: () => void; onLoadError?: (message: string) => void; dom?: import('expo/dom').DOMProps };

function PdfPage({ doc, number, width, height, root, onRendered, onLoadError }: { doc: pdfjs.PDFDocumentProxy; number: number; width: number; height: number; root: HTMLDivElement | null; onRendered: (page: number) => void; onLoadError?: (message: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
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
    if (!nearby || !canvas.current) return;
    const target = canvas.current;
    let cancelled = false;
    let task: pdfjs.RenderTask | undefined;
    setError(false);
    void doc.getPage(number).then(page => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(width / base.width, height / base.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * ratio });
      target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
      target.style.width = `${viewport.width / ratio}px`; target.style.height = `${viewport.height / ratio}px`;
      task = page.render({ canvas: target, viewport });
      return task.promise;
    }).then(() => { if (!cancelled) callbacks.current.onRendered(number); })
      .catch(() => { if (!cancelled) { setError(true); callbacks.current.onLoadError?.('PDFのページを表示できませんでした。もう一度お試しください。'); } });
    // 中断後のCanvasを再利用しないよう、画面外では要素ごと外す。
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, number, width, height, nearby]);
  return <div ref={slot} aria-label={`${number}ページ`} style={{ ...styles.page, width, height }}>
    {nearby && <canvas key={`${width}:${height}`} ref={canvas} style={{ display: 'block', maxWidth: '100%' }} />}
    {error && <p role="alert" style={styles.pageMessage}>表示できません。ページを画面外へスクロールしてから戻すか、教材を開き直してください。</p>}
    <span style={styles.pageNumber}>{number}</span>
  </div>;
}

export default function PdfBook({ uri, readLocalPdf, initialPage = 1, zoom = 1, spread = false, onReady, onLoadError, onPosition, pageRequest }: Props) {
  const callbacks = useRef({ onReady, onLoadError, onPosition, readLocalPdf }); callbacks.current = { onReady, onLoadError, onPosition, readLocalPdf };
  const rootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const host = (window as any).$$EXPO_DOM_HOST_OS;
    const native = host === 'ios' || host === 'android' || !!(window as any).ReactNativeWebView;
    if (native) {
      for (const element of [document.documentElement, document.body, document.getElementById('root')]) {
        if (element) { element.style.height = '100%'; element.style.margin = '0'; }
      }
    }
    const fit = () => { if (native && rootRef.current) rootRef.current.style.height = `${window.innerHeight}px`; };
    fit(); window.addEventListener('resize', fit);
    const stage = stageRef.current!;
    const observer = new ResizeObserver(() => setSize({ width: stage.clientWidth, height: stage.clientHeight }));
    observer.observe(stage);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDoc(null); setError('');
    let task: pdfjs.PDFDocumentLoadingTask | undefined;
    // Expo DOMの関数プロキシはprops受信のたびに変わる。ページ通知でPDFを破棄・再取得しない。
    const read = callbacks.current.readLocalPdf ? (offset: number, length: number) => callbacks.current.readLocalPdf!(offset, length) : undefined;
    void pdfSource(uri, read, () => cancelled).then(source => {
      if (cancelled) return;
      task = pdfjs.getDocument({ ...source, cMapUrl: `${cdn}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${cdn}/standard_fonts/` });
      return task.promise;
    }).then(async pdf => {
      if (!pdf || cancelled) return;
      const first = await pdf.getPage(1);
      if (cancelled) return;
      const viewport = first.getViewport({ scale: 1 });
      setPaper({ width: viewport.width, height: viewport.height }); setDoc(pdf);
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
      onPointerDown={event => { if (!spread && event.isPrimary && event.button === 0) swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
      onPointerCancel={() => { swipe.current = null; }}
      onPointerUp={event => { const from = swipe.current; swipe.current = null; if (!from || from.id !== event.pointerId || !doc) return; const turn = horizontalTurn(event.clientX - from.x, event.clientY - from.y); if (turn) jump(page + (turn === 'prev' ? 1 : -1)); }}
      tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); jump(page + (event.key === 'ArrowRight' ? step : -step)); } }}
      onClick={event => { if (!spread || !doc) return; const bounds = event.currentTarget.getBoundingClientRect(); jump(page + (event.clientX - bounds.left < bounds.width / 2 ? -2 : 2)); }} aria-label={spread ? '原文PDF・左を押すと前、右を押すと次の見開き' : '原文PDF・左へスワイプで次のページ、右へスワイプで前のページ'}>
      {error ? <p role="alert" style={styles.message}>{error}</p> : !doc ? <p role="status" style={styles.message}>教材を読み込んでいます…</p> : size.width > 0 && <div style={{ ...styles.paperList, height: '100%', justifyContent: zoom > 1 ? 'flex-start' : 'center', padding: 0, gap: 0 }}>
        {Array.from({ length: Math.ceil(total / step) }, (_, index) => {
          const start = index * step + 1;
          if (start !== page) return null;
          return <div key={start} data-page={start} style={{ ...styles.paperRow, gap: spread ? 2 : 0 }}>
            {Array.from({ length: Math.min(step, total - start + 1) }, (_, offset) => <PdfPage key={`${uri}:${start + offset}`} doc={doc} number={start + offset} width={pageWidth} height={pageHeight} root={stageRef.current}
              onRendered={number => { const target = Math.max(1, Math.min(total, initialPage)); if (number === target - ((target - 1) % step)) callbacks.current.onReady?.(); }} onLoadError={onLoadError} />)}
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
