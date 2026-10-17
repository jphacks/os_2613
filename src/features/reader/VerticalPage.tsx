'use dom';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// 小説の本文を本のような縦書き（右から左へ読む）で表示し、画面に収まる行数ごとにページを区切る。
// React Native では縦書きができないので、DOMコンポーネント（iOSでは内部のWebView）で描く。
//
// 区切り方：1行の幅（行送り）を固定し、紙面の幅に入る行数 × 行送り を1ページの幅とする。
// 本文全体を横に長く組んでおき、ページの幅ずつ横へずらして見せる。
// 読みガイドをONにすると、見えているページの中で今読む文字を決めた速さで順に強調する。

const FONT_SIZE = 24;
const STEP = 50; // 行送り（px）。行の幅をそろえると、ページの境目で行が切れない

type Props = {
  text: string;
  start: number; // この本文の先頭が本全体の何文字目か（しおりの位置と揃えるため）
  sub: number; // 何ページ目を見せるか。-1 は最後のページ
  marks: number[]; // しおりが挟まっている位置
  faded: number | null; // 移動中のしおり（薄く表示する）
  picking: boolean; // しおりを挟む位置を選んでいるところか
  draft: number | null; // 選んだ位置
  guide: boolean;
  running: boolean;
  speed: number; // 1分あたりの文字数
  onPages: (count: number) => void; // 区切ったページ数を知らせる
  onNext: () => void;
  onPrev: () => void;
  onPick: (offset: number) => void;
  onMarkPress: (offset: number) => void;
  dom?: import('expo/dom').DOMProps;
};

export default function VerticalPage({ text, start, sub, marks, faded, picking, draft, guide, running, speed, onPages, onNext, onPrev, onPick, onMarkPress }: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ count: 1, width: 0, pageOf: [] as number[] });
  const sentCount = useRef(0);
  const [cursor, setCursor] = useState(0); // 読みガイドが今強調している文字の番号

  // 1文字ずつに分け、本全体での位置（終わり）を持たせる。絵文字の途中では切らない。
  let position = start;
  const chars = Array.from(text).map(char => {
    position += char.length;
    return { char, end: position };
  });

  const page = sub < 0 ? layout.count - 1 : Math.min(sub, layout.count - 1);

  // 紙面の大きさと本文から、ページ数と「各文字が何ページ目にあるか」を測る
  const measure = useCallback(() => {
    const view = viewRef.current, body = textRef.current;
    if (!view || !body) return;
    const perPage = Math.max(1, Math.floor(view.clientWidth / STEP));
    const width = perPage * STEP;
    const lines = Math.max(1, Math.round(body.offsetWidth / STEP));
    const count = Math.max(1, Math.ceil(lines / perPage));
    const right = body.getBoundingClientRect().right;
    const pageOf = Array.from(body.querySelectorAll<HTMLElement>('[data-i]')).map(node =>
      Math.max(0, Math.floor((right - node.getBoundingClientRect().right) / width)));
    setLayout({ count, width, pageOf });
    // アプリ側への連絡は、ページ数が変わったときだけにする（送りすぎると iPhone でエラーになる）
    if (sentCount.current !== count) { sentCount.current = count; onPages(count); }
  }, [text]);

  useLayoutEffect(() => {
    // iPhone では内部のWebViewの中で描かれ、そのページの高さが0のままだと紙面が潰れる。
    // WebViewの中にいるときだけ、ページ全体の高さを画面いっぱいにする（Webでは親の高さに従う）。
    if ((window as any).ReactNativeWebView) {
      for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
        if (el) { el.style.height = '100%'; el.style.margin = '0'; }
      }
    }
    measure();
    void document.fonts?.ready.then(measure);
    const view = viewRef.current;
    if (!view) return;
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    return () => observer.disconnect();
  }, [measure]);

  // ページが変わったら、ガイドをそのページの最初の文字へ
  useEffect(() => {
    const first = layout.pageOf.findIndex(p => p === page);
    setCursor(first < 0 ? 0 : first);
  }, [page, layout]);

  // ガイドを進める。改行は待たずに飛ばし、次の文字が次のページなら めくる。
  useEffect(() => {
    if (!guide || !running || picking || !layout.width) return;
    const wait = chars[cursor]?.char === '\n' ? 0 : 60000 / speed;
    const timer = setTimeout(() => {
      const next = cursor + 1;
      if (next >= chars.length || layout.pageOf[next] !== page) onNext();
      else setCursor(next);
    }, wait);
    return () => clearTimeout(timer);
  }, [guide, running, picking, cursor, speed, page, layout, chars.length]);

  function ribbon(offset: number) {
    const marked = marks.includes(offset);
    const chosen = picking && draft === offset;
    if (!marked && !chosen) return null;
    return (
      <span
        style={{ ...styles.ribbon, opacity: marked && faded === offset ? 0.25 : 1 }}
        onClick={e => { e.stopPropagation(); if (marked && !picking) onMarkPress(offset); }}
      >▮</span>
    );
  }

  // 読んだ所までの文字が、薄い色から濃い色へ浮かび上がる（背景は付けない）
  function guideStyle(i: number): React.CSSProperties {
    if (!guide) return {};
    return i <= cursor ? { color: '#292E29' } : {};
  }

  // ページのめくり方
  // ・スマホ：スワイプ。縦書きの本は左へ進むので、指を右へ動かすと次、左へ動かすと前のページ
  // ・PC：紙面の左側を押すと次、右側を押すと前のページ
  const touchX = useRef<number | null>(null);
  const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
  function turn(e: React.MouseEvent<HTMLDivElement>) {
    if (picking || touch) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX < box.left + box.width / 2) onNext(); else onPrev();
  }
  function swipeEnd(e: React.TouchEvent<HTMLDivElement>) {
    const startX = touchX.current;
    touchX.current = null;
    if (startX === null || picking) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx > 40) onNext();
    else if (dx < -40) onPrev();
  }

  return (
    <div style={styles.root} onClick={turn} onTouchStart={e => { touchX.current = e.touches[0].clientX; }} onTouchEnd={swipeEnd}>
      <div ref={viewRef} style={styles.view}>
        {/* ページの幅ちょうどで切り取り、右端（読み始め）にそろえる */}
        <div style={{ ...styles.clip, width: layout.width || '100%' }}>
          <div
            ref={textRef}
            style={{
              ...styles.text,
              color: guide ? '#C9CBC2' : '#292E29',
              cursor: picking ? 'pointer' : 'auto',
              transform: `translateX(${page * layout.width}px)`,
            }}
          >
            {ribbon(start)}
            {chars.map(({ char, end }, i) => (
              <span
                key={end}
                data-i={i}
                onClick={picking ? e => { e.stopPropagation(); onPick(end); } : undefined}
                style={{ transition: 'color 0.4s', ...guideStyle(i), ...(picking && draft === end ? styles.chosen : null) }}
              >
                {char}
                {ribbon(end)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { height: '100%', background: '#FFFDF8', padding: '48px 40px', boxSizing: 'border-box', userSelect: 'none' },
  view: { position: 'relative', height: '100%', display: 'flex', justifyContent: 'flex-end' },
  clip: { position: 'relative', height: '100%', overflow: 'hidden' },
  text: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
    width: 'max-content',
    writingMode: 'vertical-rl',
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
    fontSize: FONT_SIZE,
    lineHeight: `${STEP}px`,
    letterSpacing: '0.05em',
    whiteSpace: 'pre-wrap',
    transition: 'color 0.2s',
  },
  ribbon: { color: '#386149', fontWeight: 'bold', cursor: 'pointer' },
  chosen: { background: '#DEDFD4' },
};
