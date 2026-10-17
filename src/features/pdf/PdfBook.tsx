'use dom';

import * as pdfjs from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';

// PDFを本のように見開きで表示する。
// React Native では描けないので、DOMコンポーネント（iOSでは内部のWebView）で pdf.js を使う。
// 描画処理を別スレッドで動かす worker は、入れたものと同じ版を配信元から読む。
const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`;
pdfjs.GlobalWorkerOptions.workerSrc = `${cdn}/build/pdf.worker.min.mjs`;

type Props = {
  uri: string;
  dom?: import('expo/dom').DOMProps;
};

export default function PdfBook({ uri }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [spread, setSpread] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError('');
    pdfjs
      // 日本語のPDFは文字の対応表（CMap）が無いと文字が描けないので、あわせて読み込む
      .getDocument({ url: uri, cMapUrl: `${cdn}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${cdn}/standard_fonts/` })
      .promise.then(d => { if (!cancelled) setDoc(d); })
      .catch(() => { if (!cancelled) setError('教材を開けませんでした。通信を確認して、開き直してください。'); });
    return () => { cancelled = true; };
  }, [uri]);

  // 横に余裕があるときだけ見開きにする。狭い画面では1ページずつ。
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setSpread(stage.clientWidth >= 760));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !stageRef.current) return;
    const stage = stageRef.current;
    const targets = spread ? [leftRef.current, rightRef.current] : [leftRef.current];
    const tasks: pdfjs.RenderTask[] = [];

    targets.forEach((canvas, i) => {
      const number = page + i;
      if (!canvas) return;
      if (number > doc.numPages) { canvas.width = 0; canvas.height = 0; return; }
      void doc.getPage(number).then(p => {
        // 紙面の高さに収まる倍率を求め、画面の解像度に合わせて鮮明に描く
        const base = p.getViewport({ scale: 1 });
        const maxW = (stage.clientWidth - 48) / targets.length;
        const maxH = stage.clientHeight - 32;
        const scale = Math.min(maxW / base.width, maxH / base.height);
        const ratio = window.devicePixelRatio || 1;
        const view = p.getViewport({ scale: scale * ratio });
        canvas.width = view.width;
        canvas.height = view.height;
        canvas.style.width = `${view.width / ratio}px`;
        canvas.style.height = `${view.height / ratio}px`;
        const task = p.render({ canvas, viewport: view });
        tasks.push(task);
        task.promise.catch(() => {});
      });
    });
    return () => tasks.forEach(t => t.cancel());
  }, [doc, page, spread]);

  const step = spread ? 2 : 1;
  const total = doc?.numPages ?? 0;
  const last = Math.min(page + step - 1, total);

  return (
    <div style={styles.root}>
      <div ref={stageRef} style={styles.stage}>
        {error ? <p style={styles.message}>{error}</p> : !doc ? <p style={styles.message}>教材を読み込んでいます…</p> : null}
        <canvas ref={leftRef} style={styles.page} />
        {spread && <canvas ref={rightRef} style={styles.page} />}
      </div>
      <div style={styles.bar}>
        <button style={styles.button} disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - step))}>‹ 前</button>
        {/* 今どのあたりを読んでいるかを示すバー。ドラッグで好きなページへ飛べる */}
        <input
          type="range"
          aria-label="ページの位置"
          min={1}
          max={Math.max(1, total)}
          value={page}
          disabled={!total}
          style={styles.seek}
          onChange={e => {
            const p = Number(e.target.value);
            // 見開きのときは、左ページが奇数になるようにそろえる
            setPage(spread ? p - ((p - 1) % 2) : p);
          }}
        />
        <span style={styles.count}>{total ? `${page}${last > page ? `–${last}` : ''} / ${total}` : ''}</span>
        <button style={styles.button} disabled={!total || page + step > total} onClick={() => setPage(p => p + step)}>次 ›</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', background: '#F6F2E9', fontFamily: 'system-ui, sans-serif' },
  stage: { position: 'relative', flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: 16, overflow: 'hidden' },
  page: { background: '#fff', boxShadow: '0 2px 10px rgba(41,46,41,0.12)' },
  message: { position: 'absolute', color: '#73776E', fontSize: 13 },
  bar: { flex: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 10, borderTop: '1px solid #DEDFD4' },
  button: { font: 'inherit', fontSize: 13, padding: '8px 16px', borderRadius: 10, border: '1px solid #DEDFD4', background: '#FFFDF8', color: '#386149', cursor: 'pointer' },
  count: { fontSize: 12, color: '#73776E', minWidth: 90, textAlign: 'center' },
  seek: { flex: 1, maxWidth: 520, accentColor: '#386149' },
};
