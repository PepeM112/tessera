import { createContext, use, type ReactNode } from "react";

import type { ModuleMap, SplitPatch } from "./layout";
import type { TileSize } from "./size";

interface WorkspaceContextValue {
  modules: ModuleMap;
  renderUnknown: (moduleId: string) => ReactNode;
  dividerLabel: string;
  /** `aria-label` of a window dot. `position` starts at 1. */
  windowLabel: (position: number, total: number) => string;
  /** Sets the child sizes of the split at `path`. `isFinal` sends the new layout to `onLayoutChange`. */
  resize: (path: string, sizes: readonly (TileSize | undefined)[], isFinal: boolean) => void;
  /** Sets the child sizes of the split at `path` back to the sizes of the `layout` prop. */
  reset: (path: string) => void;
  /** Writes the frozen sizes and spacers of a split after a removal. Patches of one tick make one `onLayoutChange`. */
  commitSplit: (path: string, patch: SplitPatch) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext(): WorkspaceContextValue {
  const value = use(WorkspaceContext);
  if (!value) throw new Error("Tessera tiles render only inside a <Workspace>");
  return value;
}
