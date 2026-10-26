import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getTileAt, isSplitTile, withSplitSizes, type Layout, type ModuleMap } from "./layout";
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

const DEFAULT_LABELS = { divider: "Resize tiles", unknownModule: "Unknown module" } satisfies Required<WorkspaceLabels>;

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
  const latest = useRef({ current, source, onLayoutChange });

  // A new layout prop resets the sizes (state reset during render, the React pattern for derived state).
  if (source !== layout) {
    setSource(layout);
    setCurrent(layout);
  }

  useLayoutEffect(() => {
    latest.current = { current, source, onLayoutChange };
  });

  const resize = useCallback((path: string, sizes: readonly (TileSize | undefined)[], isFinal: boolean) => {
    // The ref holds the newest layout at once, so two events before the next render do not lose a change.
    const next = withSplitSizes(latest.current.current, path, sizes);
    latest.current.current = next;
    setCurrent(next);
    if (isFinal) latest.current.onLayoutChange?.(next);
  }, []);

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

  const context = useMemo(
    () => ({
      modules,
      dividerLabel,
      resize,
      reset,
      renderUnknown:
        renderUnknown ??
        ((moduleId: string) => <div className="tessera-unknown">{`${unknownLabel}: ${moduleId}`}</div>),
    }),
    [modules, dividerLabel, resize, reset, renderUnknown, unknownLabel],
  );

  return (
    <div className={className ? `tessera-workspace ${className}` : "tessera-workspace"} style={themeToStyle(theme)}>
      <WorkspaceContext value={context}>
        <TileNode tile={current.root} path="" isInResizableSplit={false} />
      </WorkspaceContext>
    </div>
  );
}
