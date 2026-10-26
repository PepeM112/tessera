import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

interface PointerDragOptions {
  onMove: (event: PointerEvent) => void;
  /** Called once when the pointer is released or the browser cancels it. Not called on unmount. */
  onEnd?: (event: PointerEvent) => void;
  /** Body cursor during the drag (the pointer often leaves the handle). */
  cursor?: string;
}

/**
 * Drag logic for resize handles. It listens on `document`, so the drag goes on when the pointer leaves the
 * handle. During the drag the body gets `cursor` and `user-select: none`; both go back at the end.
 * `onMove` and `onEnd` can be new functions on each render: the latest ones are used.
 */
export function usePointerDrag({ onMove, onEnd, cursor }: PointerDragOptions): (event: ReactPointerEvent) => void {
  const latest = useRef({ onMove, onEnd, cursor });
  const teardownRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    latest.current = { onMove, onEnd, cursor };
  });

  const teardown = useCallback(() => {
    teardownRef.current?.();
    teardownRef.current = null;
  }, []);

  // A drag still active at unmount must not leave listeners or a locked body behind.
  useEffect(() => teardown, [teardown]);

  return useCallback(
    (event: ReactPointerEvent) => {
      // Only the main button. A right click opens the context menu and the release never arrives.
      if (event.button !== 0) return;
      teardown();

      // Follow only the pointer that started the drag (a second finger must not move it).
      const { pointerId } = event;
      const { style } = document.body;
      const previous = { cursor: style.cursor, userSelect: style.userSelect };
      if (latest.current.cursor) style.cursor = latest.current.cursor;
      style.userSelect = "none";

      const handleMove = (moveEvent: PointerEvent): void => {
        if (moveEvent.pointerId === pointerId) latest.current.onMove(moveEvent);
      };
      const handleEnd = (endEvent: PointerEvent): void => {
        if (endEvent.pointerId !== pointerId) return;
        teardown();
        latest.current.onEnd?.(endEvent);
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleEnd);
      document.addEventListener("pointercancel", handleEnd);
      teardownRef.current = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleEnd);
        document.removeEventListener("pointercancel", handleEnd);
        style.cursor = previous.cursor;
        style.userSelect = previous.userSelect;
      };
    },
    [teardown],
  );
}
