import type { SplitDirection } from "./size";
import type { KeyboardEvent, PointerEvent } from "react";

interface DividerProps {
  index: number;
  direction: SplitDirection;
  label: string;
  isDragging: boolean;
  onPointerDown: (index: number, event: PointerEvent) => void;
  onKeyDown: (index: number, event: KeyboardEvent) => void;
  onDoubleClick: () => void;
}

// aria-valuenow is set on the DOM by useSplitResize.
export function Divider({
  index,
  direction,
  label,
  isDragging,
  onPointerDown,
  onKeyDown,
  onDoubleClick,
}: DividerProps) {
  const handlePointerDown = (event: PointerEvent): void => onPointerDown(index, event);
  const handleKeyDown = (event: KeyboardEvent): void => onKeyDown(index, event);

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={direction === "row" ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      className="tessera-divider"
      data-resizable=""
      data-dragging={isDragging ? "" : undefined}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={onDoubleClick}
    />
  );
}
