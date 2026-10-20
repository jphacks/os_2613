import { useRef, type ReactNode, type PointerEvent } from 'react';

export type BookmarkDragPoint = { x: number; y: number; phase: 'move' | 'end' | 'cancel' };

export function BookmarkHandle({ disabled, onOpen, onPlace, onDrag, children }: {
  disabled: boolean; onOpen: () => void; onPlace: () => void;
  onDrag: (point: BookmarkDragPoint) => void; children: ReactNode;
}) {
  const gesture = useRef<{ id: number; x: number; y: number; started: number; dragged: boolean } | null>(null);
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    if (current.dragged) onDrag({ x: event.clientX, y: event.clientY, phase: cancel ? 'cancel' : 'end' });
    else if (!cancel) Date.now() - current.started >= 500 ? onPlace() : onOpen();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  // 画像のHTMLドラッグでは本文にドロップできない。ポインターをボタンに捕捉して最後まで追う。
  return <button type="button" aria-label="しおり" title="タップで一覧、本文へドラッグして挟みます。長押しでも位置を選べます" disabled={disabled} draggable={false}
    onDragStartCapture={event => event.preventDefault()}
    onPointerDown={event => {
      if (disabled || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, started: Date.now(), dragged: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      if (!current.dragged && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7) return;
      current.dragged = true;
      onDrag({ x: event.clientX, y: event.clientY, phase: 'move' });
    }}
    onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}
    onLostPointerCapture={event => finish(event, true)}
    onClick={event => { if (event.detail === 0 && !disabled) onOpen(); }}
    style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 0, background: 'transparent', opacity: disabled ? 0.4 : 1, cursor: 'grab', userSelect: 'none', touchAction: 'none' }}>
    {children}
  </button>;
}
