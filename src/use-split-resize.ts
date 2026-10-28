import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { isSpacerTile, type SplitTile } from "./layout";
import {
  DEFAULT_RESIZABLE_MIN_SIZE,
  lengthToPx,
  resizePair,
  type LengthContext,
  type ResizeInput,
  type SplitDirection,
  type TileSize,
} from "./size";
import { usePointerDrag } from "./use-pointer-drag";
import { useWorkspaceContext } from "./workspace-context";

const KEY_STEP_PX = 10;

// Home and End move the divider as far as the minimum sizes let it go.
const KEY_DELTAS: Record<SplitDirection, Partial<Record<string, number>>> = {
  row: { ArrowLeft: -KEY_STEP_PX, ArrowRight: KEY_STEP_PX, Home: -Infinity, End: Infinity },
  column: { ArrowUp: -KEY_STEP_PX, ArrowDown: KEY_STEP_PX, Home: -Infinity, End: Infinity },
};

const DRAG_CURSORS: Record<SplitDirection, string> = { row: "col-resize", column: "row-resize" };

const POINTER_AXIS: Record<SplitDirection, "clientX" | "clientY"> = { row: "clientX", column: "clientY" };

type Measurement = Omit<ResizeInput, "index" | "delta">;

interface DragState {
  index: number;
  start: number;
  measurement: Measurement;
  sizes: TileSize[] | null;
}

interface SplitResize {
  containerRef: RefObject<HTMLDivElement | null>;
  draggingIndex: number | null;
  handlePointerDown: (index: number, event: ReactPointerEvent) => void;
  handleKeyDown: (index: number, event: KeyboardEvent) => void;
  handleDoubleClick: () => void;
}

/**
 * Pointer and keyboard resizing for the dividers of one split. A drag measures the tiles once at the start, and
 * each move computes the sizes from that measurement, so rounding does not add up.
 */
export function useSplitResize(split: SplitTile, path: string): SplitResize {
  const { resize, reset } = useWorkspaceContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const axis = POINTER_AXIS[split.split];
  const isResizable = split.resizable === true;

  const startDrag = usePointerDrag({
    cursor: DRAG_CURSORS[split.split],
    onMove: (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.sizes = resizePair({ ...drag.measurement, index: drag.index, delta: event[axis] - drag.start });
      resize(path, drag.sizes, false);
    },
    onEnd: () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDraggingIndex(null);
      if (drag?.sizes) resize(path, drag.sizes, true);
    },
  });

  // aria-valuenow changes with the tile sizes. It is set on the DOM, so a resize does not need a second render.
  useLayoutEffect(() => {
    if (isResizable && containerRef.current) updateDividerValues(containerRef.current, split.split);
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!isResizable || !container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateDividerValues(container, split.split));
    observer.observe(container);
    return () => observer.disconnect();
  }, [isResizable, split.split]);

  const handlePointerDown = (index: number, event: ReactPointerEvent): void => {
    const container = containerRef.current;
    if (!container || event.button !== 0) return;
    dragRef.current = { index, start: event[axis], measurement: measureSplit(container, split), sizes: null };
    setDraggingIndex(index);
    startDrag(event);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent): void => {
    const delta = KEY_DELTAS[split.split][event.key];
    const container = containerRef.current;
    if (delta === undefined || !container) return;
    event.preventDefault();
    resize(path, resizePair({ ...measureSplit(container, split), index, delta }), true);
  };

  const handleDoubleClick = (): void => reset(path);

  return { containerRef, draggingIndex, handlePointerDown, handleKeyDown, handleDoubleClick };
}

function measureSplit(container: HTMLElement, split: SplitTile): Measurement {
  const isRow = split.split === "row";
  const context: LengthContext = {
    containerPx: isRow ? container.clientWidth : container.clientHeight,
    rootFontPx: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    fontPx: parseFloat(getComputedStyle(container).fontSize) || 16,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
  return {
    sizes: split.children.map((child) => child.size),
    pixels: tileElements(container).map((element) => mainSize(element, split.split)),
    minPixels: split.children.map((child) =>
      lengthToPx((isSpacerTile(child) ? undefined : child.minSize) ?? DEFAULT_RESIZABLE_MIN_SIZE, context),
    ),
    context,
  };
}

function updateDividerValues(container: HTMLElement, direction: SplitDirection): void {
  const pixels = tileElements(container).map((element) => mainSize(element, direction));
  container.querySelectorAll(":scope > [role=separator]").forEach((divider, i) => {
    const pairTotal = pixels[i] + pixels[i + 1];
    const value = pairTotal > 0 ? Math.round((pixels[i] / pairTotal) * 100) : 50;
    divider.setAttribute("aria-valuenow", String(value));
  });
}

/** The tiles of the layout. A tile that leaves is still in the DOM, but it is not a child to resize. */
export function tileElements(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll(":scope > .tessera-tile:not([data-leaving])"));
}

export function mainSize(element: Element, direction: SplitDirection): number {
  const rect = element.getBoundingClientRect();
  return direction === "row" ? rect.width : rect.height;
}
