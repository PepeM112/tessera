import { createContext } from "react";

export interface TileActions {
  /** Removes the tile with this id from the layout. */
  removeTile: (id: string) => void;
}

export const TileActionsContext = createContext<TileActions>({ removeTile: () => undefined });
