import { isSpacerTile, isSplitTile, type Layout, type SplitTile, type Tile, type TileFlex } from "tessera";

/** A tile that left the layout, with the place it came from. */
export interface RemovedTile {
  tile: Tile;
  parentId: string;
  index: number;
}

export interface CardInfo {
  id: string;
  label: string;
}

interface Place {
  parent: SplitTile & { id: string };
  index: number;
}

export function listCards(tile: Tile): CardInfo[] {
  if (isSplitTile(tile)) return tile.children.flatMap(listCards);
  if (isSpacerTile(tile) || !tile.id) return [];
  return [{ id: tile.id, label: tile.id.charAt(0).toUpperCase() + tile.id.slice(1) }];
}

export function findTile(tile: Tile, id: string): Tile | undefined {
  if (tile.id === id) return tile;
  return isSplitTile(tile) ? tile.children.map((child) => findTile(child, id)).find((found) => found) : undefined;
}

/** A spacer has the id of the tile it replaced, but it is not a card on screen. */
export function isTileShown(layout: Layout, id: string): boolean {
  const tile = findTile(layout.root, id);
  return tile !== undefined && !isSpacerTile(tile);
}

/** A split keeps at least one tile that is not a spacer. */
export function canRemoveTile(layout: Layout, id: string): boolean {
  const place = findPlace(layout.root, id);
  return place !== undefined && place.parent.children.filter((child) => !isSpacerTile(child)).length > 1;
}

export function removeTile(layout: Layout, id: string): { layout: Layout; removed: RemovedTile } | undefined {
  const place = findPlace(layout.root, id);
  const tile = place?.parent.children[place.index];
  if (!place || !tile || !canRemoveTile(layout, id)) return undefined;
  const removed: RemovedTile = { tile, parentId: place.parent.id, index: place.index };
  const root = updateChildren(layout.root, place.parent.id, (children) => children.toSpliced(place.index, 1));
  return { layout: { ...layout, root }, removed };
}

/** Puts the tile back. It replaces the spacer that holds its place: the spacer with its id, or else the one at its index. */
export function restoreTile(layout: Layout, { tile, parentId, index }: RemovedTile): Layout {
  const root = updateChildren(layout.root, parentId, (children) => {
    const spacerIndex = children.findIndex((child) => isSpacerTile(child) && child.id === tile.id);
    const at = spacerIndex >= 0 ? spacerIndex : Math.min(index, children.length);
    const holder = children[at];
    return children.toSpliced(at, holder && isSpacerTile(holder) ? 1 : 0, tile);
  });
  return { ...layout, root };
}

export function flexOf(layout: Layout, id: string): TileFlex {
  const tile = findTile(layout.root, id);
  return tile && !isSpacerTile(tile) ? (tile.flex ?? "grow") : "grow";
}

export function withFlex(layout: Layout, id: string, flex: TileFlex): Layout {
  return { ...layout, root: updateTile(layout.root, id, (tile) => (isSpacerTile(tile) ? tile : { ...tile, flex })) };
}

function findPlace(tile: Tile, id: string): Place | undefined {
  if (!isSplitTile(tile)) return undefined;
  const index = tile.children.findIndex((child) => child.id === id);
  if (index >= 0 && tile.id) return { parent: { ...tile, id: tile.id }, index };
  return tile.children.map((child) => findPlace(child, id)).find((place) => place !== undefined);
}

function updateTile(tile: Tile, id: string, update: (tile: Tile) => Tile): Tile {
  if (tile.id === id) return update(tile);
  if (!isSplitTile(tile)) return tile;
  return { ...tile, children: tile.children.map((child) => updateTile(child, id, update)) };
}

function updateChildren(tile: Tile, id: string, update: (children: Tile[]) => Tile[]): Tile {
  return updateTile(tile, id, (found) => (isSplitTile(found) ? { ...found, children: update(found.children) } : found));
}
