import { createContext, use } from "react";

/** The tile a module renders in. */
export interface TileInfo {
  /** The `id` of the tile. It is `undefined` when the layout gives the tile none. */
  id: string | undefined;
  /** The child indexes from the root, joined with dots. The root is `""`. */
  path: string;
}

export const TileContext = createContext<TileInfo | null>(null);

/** Returns the tile of the module that calls it. Call it only in a module that a `Workspace` renders. */
export function useTile(): TileInfo {
  const value = use(TileContext);
  if (!value) throw new Error("useTile works only inside a module that a <Workspace> renders");
  return value;
}
