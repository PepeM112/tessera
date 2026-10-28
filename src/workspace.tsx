import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  getTileAt,
  isSplitTile,
  withSplitPatch,
  withSplitSizes,
  type Layout,
  type ModuleMap,
  type SplitPatch,
} from "./layout";
import { themeToStyle, type WorkspaceTheme } from "./theme";
import { TileNode } from "./tile-node";
import { WorkspaceContext } from "./workspace-context";

import type { TileSize } from "./size";

/** The text the Workspace shows. English by default. */
export interface WorkspaceLabels {
  /** `aria-label` of a resizable divider. */
  divider?: string;
  /** Text before the id of a module that is not in `modules`. */
  unknownModule?: string;
  /** `aria-label` of a window dot. `position` starts at 1. Default: "Window 2 of 3". */
  window?: (position: number, total: number) => string;
}

export interface WorkspaceProps {
  layout: Layout;
  /** Module id → React component. Define it outside the render, so its identity stays the same. */
  modules: ModuleMap;
  theme?: WorkspaceTheme;
  /** Called with the new layout at the end of a divider drag, a divider key press or a reset. */
  onLayoutChange?: (layout: Layout) => void;
  /** Renders a tile whose module id is not in `modules`. */
  renderUnknown?: (moduleId: string) => ReactNode;
  labels?: WorkspaceLabels;
  className?: string;
}

const DEFAULT_LABELS = {
  divider: "Resize tiles",
  unknownModule: "Unknown module",
  window: (position, total) => `Window ${position} of ${total}`,
} satisfies Required<WorkspaceLabels>;

/** Renders a layout as tiles. It fills its parent, so give the parent a size. */
export function Workspace({
  layout,
  modules,
  theme,
  onLayoutChange,
  renderUnknown,
  labels,
  className,
}: WorkspaceProps) {
  const [source, setSource] = useState(layout);
  const [current, setCurrent] = useState(layout);
  // True after a resize by the user: the sizes follow the pointer, so they must not use the transition.
  const [isInstant, setIsInstant] = useState(false);
  const latest = useRef({ current, source, onLayoutChange });
  const pendingPatches = useRef(new Map<string, SplitPatch>());
  const flushTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A new layout prop resets the sizes (state reset during render, the React pattern for derived state).
  if (source !== layout) {
    setSource(layout);
    setCurrent(layout);
    setIsInstant(false);
  }

  useLayoutEffect(() => {
    latest.current = { current, source, onLayoutChange };
  });

  const resize = useCallback((path: string, sizes: readonly (TileSize | undefined)[], isFinal: boolean) => {
    // The ref holds the newest layout at once, so two events before the next render do not lose a change.
    const next = withSplitSizes(latest.current.current, path, sizes);
    latest.current.current = next;
    setCurrent(next);
    setIsInstant(true);
    if (isFinal) latest.current.onLayoutChange?.(next);
  }, []);

  const flushPatches = useCallback(() => {
    flushTimer.current = undefined;
    const patches = [...pendingPatches.current].sort(([a], [b]) => pathDepth(b) - pathDepth(a));
    pendingPatches.current.clear();
    const before = latest.current.current;
    // Deepest first: a patch can add a spacer, which moves the indexes of the tiles after it in that split only.
    const next = patches.reduce((layout, [path, patch]) => withSplitPatch(layout, path, patch), before);
    if (next === before) return;
    latest.current.current = next;
    setCurrent(next);
    latest.current.onLayoutChange?.(next);
  }, []);

  // Splits that finish in the same tick make one call. A later patch of a split has all the edits of the earlier one.
  const commitSplit = useCallback(
    (path: string, patch: SplitPatch) => {
      pendingPatches.current.set(path, patch);
      flushTimer.current ??= setTimeout(flushPatches, 0);
    },
    [flushPatches],
  );

  useEffect(
    () => () => {
      clearTimeout(flushTimer.current);
      flushTimer.current = undefined;
    },
    [],
  );

  const reset = useCallback(
    (path: string) => {
      const split = getTileAt(latest.current.source.root, path);
      if (split && isSplitTile(split))
        resize(
          path,
          split.children.map((child) => child.size),
          true,
        );
    },
    [resize],
  );

  const dividerLabel = labels?.divider ?? DEFAULT_LABELS.divider;
  const unknownLabel = labels?.unknownModule ?? DEFAULT_LABELS.unknownModule;
  const windowLabel = labels?.window ?? DEFAULT_LABELS.window;

  const context = useMemo(
    () => ({
      modules,
      dividerLabel,
      windowLabel,
      resize,
      reset,
      commitSplit,
      renderUnknown:
        renderUnknown ??
        ((moduleId: string) => <div className="tessera-unknown">{`${unknownLabel}: ${moduleId}`}</div>),
    }),
    [modules, dividerLabel, windowLabel, resize, reset, commitSplit, renderUnknown, unknownLabel],
  );

  return (
    <div
      className={className ? `tessera-workspace ${className}` : "tessera-workspace"}
      data-instant={isInstant ? "" : undefined}
      style={themeToStyle(theme)}
    >
      <WorkspaceContext value={context}>
        <TileNode tile={current.root} path="" isInResizableSplit={false} />
      </WorkspaceContext>
    </div>
  );
}

function pathDepth(path: string): number {
  return path === "" ? 0 : path.split(".").length;
}
