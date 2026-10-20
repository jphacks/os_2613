import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { colors } from './theme';
let lastTrigger: HTMLElement | null = null;

export function DesktopReaderPopover({ visible, label, onClose, children }: { visible: boolean; label: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null), anchor = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 64, width: 340, height: 480 });
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const remember = (event: PointerEvent) => { const target = event.target; if (target instanceof Element && !target.closest('[data-reader-popover]')) { const button = target.closest<HTMLElement>('button,[role="button"],[role="tab"]'); if (button) lastTrigger = button; } };
    document.addEventListener('pointerdown', remember, true);
    return () => document.removeEventListener('pointerdown', remember, true);
  }, []);
  useLayoutEffect(() => {
    if (!visible) return;
    anchor.current = lastTrigger?.isConnected ? lastTrigger : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 24);
      const top = Math.max(12, Math.min(rect?.bottom ? rect.bottom + 8 : 100, window.innerHeight - 172));
      setPosition({ left: Math.max(12, Math.min(rect?.left ?? 12, window.innerWidth - width - 12)), top, width, height: Math.min(560, window.innerHeight - top - 12) });
    };
    place();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !panel.current?.contains(event.target) && !anchor.current?.contains(event.target)) close.current(); };
    // 同じボタンで閉じる時もパネルの保存処理を通し、開くonPressの再実行を防ぐ。
    const toggle = (event: MouseEvent) => { if (event.target instanceof Node && anchor.current?.contains(event.target)) { event.preventDefault(); event.stopPropagation(); close.current(); } };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { close.current(); anchor.current?.focus(); } };
    window.addEventListener('resize', place); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', keyboard); document.addEventListener('click', toggle, true);
    return () => { window.removeEventListener('resize', place); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); document.removeEventListener('click', toggle, true); };
  }, [visible]);
  if (!visible || typeof document === 'undefined') return null;
  return createPortal(<div ref={panel} role="dialog" aria-label={label} data-reader-popover style={{ position: 'fixed', ...position, zIndex: 10000, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 12, borderRadius: 16, background: colors.surface, boxShadow: '0 8px 28px rgba(41,46,41,0.18)', overflow: 'hidden' }}>{children}</div>, document.body);
}
