import { useMemo, useRef, type ReactNode } from 'react';
import { PanResponder, Pressable, View } from 'react-native';

export type BookmarkDragPoint = { x: number; y: number; phase: 'move' | 'end' | 'cancel' };

export function BookmarkHandle({ disabled, onOpen, onPlace, onDrag, children }: {
  disabled: boolean; onOpen: () => void; onPlace: () => void;
  onDrag: (point: BookmarkDragPoint) => void; children: ReactNode;
}) {
  const latest = useRef({ disabled, onOpen, onPlace, onDrag }); latest.current = { disabled, onOpen, onPlace, onDrag };
  const dragged = useRef(false), started = useRef(0);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => !latest.current.disabled,
    onPanResponderGrant: () => { dragged.current = false; started.current = Date.now(); },
    onPanResponderMove: (_, gesture) => {
      if (!dragged.current && Math.hypot(gesture.dx, gesture.dy) < 7) return;
      dragged.current = true;
      latest.current.onDrag({ x: gesture.moveX, y: gesture.moveY, phase: 'move' });
    },
    onPanResponderRelease: (event) => {
      if (dragged.current) latest.current.onDrag({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, phase: 'end' });
      else if (Date.now() - started.current >= 500) latest.current.onPlace();
      else latest.current.onOpen();
    },
    onPanResponderTerminate: () => { if (dragged.current) latest.current.onDrag({ x: 0, y: 0, phase: 'cancel' }); },
    onPanResponderTerminationRequest: () => false,
  }), []);
  return <View {...responder.panHandlers}>
    <Pressable accessibilityRole="button" accessibilityLabel="しおり"
      accessibilityHint="タップで一覧、本文へドラッグして挟みます。長押しでも位置を選べます"
      disabled={disabled}
      onLongPress={onPlace}
      onPress={onOpen}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
      {children}
    </Pressable>
  </View>;
}
