import { isSpacerTile, type SpacerTile, type SplitPatch, type Tile, type TileFlex } from "./layout";

import type { CssLength } from "./size";

/** `"collapse"`: the tile shrinks to 0. `"hold"`: the tile keeps its pixel size, empty, and a spacer replaces it. */
export type LeavingMode = "collapse" | "hold";

/** A tile that is no longer in the layout and still animates out. */
export interface LeavingTile {
  key: string;
  tile: Tile;
  /** Its index in the children before the removal. */
  index: number;
  /** The key of the tile before it. `null` when it was the first. */
  afterKey: string | null;
  /** `undefined` until the animation is planned. */
  mode?: LeavingMode;
  /** Pixel size, for `"hold"`. */
  px?: number;
  /** A held tile has finished its animation and waits for the spacer from the write-back. */
  isDone?: boolean;
}

/** What one split remembers between layouts. */
export interface Presence {
  /** The children of the last layout. */
  children: readonly Tile[];
  leaving: readonly LeavingTile[];
  /** Keys of tiles that were added after the split mounted. */
  entered: readonly string[];
  /** Key → pixel size of a tile that keeps its size while another tile leaves. */
  frozen: Readonly<Record<string, number>>;
}

export type EntryState = "present" | "entering" | "leaving";

export interface PresenceEntry {
  key: string;
  /** A frozen tile has its pixel size. */
  tile: Tile;
  /** The index in the layout's children. A leaving tile has the index it had before. */
  index: number;
  state: EntryState;
  /** Only for a leaving tile. `undefined`: the animation is not planned yet. */
  mode?: LeavingMode;
  isFrozen: boolean;
}

export interface DividerInfo {
  /** The divider index for the resize hooks. `null`: a plain divider, because a neighbour is leaving. */
  resizableIndex: number | null;
  isCollapsing: boolean;
  isEntering: boolean;
}

export interface RemovalSibling {
  flex: TileFlex;
  /** The size is a share, so it changes when a sibling leaves. */
  isShare: boolean;
  px: number;
}

export interface RemovalPlan {
  mode: LeavingMode;
  /** The pixel size to freeze, for each sibling. `undefined`: the tile keeps its size value. */
  frozen: readonly (number | undefined)[];
}

const NO_FROZEN: Readonly<Record<string, number>> = {};

/** An id key never equals an index key, so the id `"1"` does not meet the index 1. */
export function childKey(tile: Tile, index: number): string {
  return tile.id === undefined ? `index:${index}` : idKey(tile.id);
}

export function idKey(id: string): string {
  return `id:${id}`;
}

/** What the tile does when a sibling is removed. A spacer keeps its size. */
export function tileFlex(tile: Tile): TileFlex {
  return isSpacerTile(tile) ? "static" : (tile.flex ?? "grow");
}

export function initialPresence(children: readonly Tile[]): Presence {
  return { children, leaving: [], entered: [], frozen: NO_FROZEN };
}

/**
 * Compares the new children with the last ones. A tile with an id that is gone leaves, a new one enters.
 * Tiles without an id just change. Returns the same object when the children did not change.
 */
export function followChildren(presence: Presence, children: readonly Tile[]): Presence {
  if (presence.children === children) return presence;
  const nextKeys = children.map(childKey);
  const previousKeys = presence.children.map(childKey);
  const isNext = (key: string): boolean => nextKeys.includes(key);

  const kept = presence.leaving.filter((leaving) => !isNext(leaving.key));
  const removed = presence.children.flatMap((tile, index): LeavingTile[] => {
    const key = previousKeys[index];
    if (tile.id === undefined || isNext(key)) return [];
    const anchor = presence.children
      .slice(0, index)
      .findLastIndex((before, i) => before.id !== undefined || isNext(previousKeys[i]));
    return [{ key, tile, index, afterKey: anchor < 0 ? null : previousKeys[anchor] }];
  });
  const added = children.flatMap((tile, index) => {
    const key = nextKeys[index];
    const isNew = tile.id !== undefined && !previousKeys.includes(key) && !presence.leaving.some((l) => l.key === key);
    return isNew ? [key] : [];
  });

  return {
    children,
    leaving: [...kept, ...removed],
    entered: [...presence.entered.filter(isNext), ...added],
    frozen: NO_FROZEN,
  };
}

/** The tiles to render, in order. A leaving tile stays where it was. */
export function listEntries(presence: Presence, children: readonly Tile[]): PresenceEntry[] {
  const keys = children.map(childKey);
  const known = new Set([...keys, ...presence.leaving.map((leaving) => leaving.key)]);
  const anchorOf = (leaving: LeavingTile): string | null =>
    leaving.afterKey !== null && known.has(leaving.afterKey) ? leaving.afterKey : null;

  const leavingAfter = (anchor: string | null): PresenceEntry[] =>
    presence.leaving
      .filter((leaving) => anchorOf(leaving) === anchor)
      .flatMap((leaving) => [leavingEntry(leaving), ...leavingAfter(leaving.key)]);

  const present = children.map((tile, index): PresenceEntry => {
    const key = keys[index];
    const px = presence.frozen[key];
    return {
      key,
      tile: px === undefined ? tile : withPixelSize(tile, px),
      index,
      state: presence.entered.includes(key) ? "entering" : "present",
      isFrozen: px !== undefined,
    };
  });

  return [...leavingAfter(null), ...present.flatMap((entry) => [entry, ...leavingAfter(entry.key)])];
}

/** How the divider before `entries[position]` looks and acts. `position` is at least 1. */
export function describeDivider(entries: readonly PresenceEntry[], position: number): DividerInfo {
  const entry = entries[position];
  const before = entries.slice(0, position);
  const isCollapsing = (item: PresenceEntry): boolean => item.state === "leaving" && item.mode === "collapse";
  const isLeaving = (item: PresenceEntry): boolean => item.state === "leaving";
  // The divider of a first tile that leaves or enters has no tile before it, so it goes with the tile after it.
  return {
    resizableIndex:
      isLeaving(entry) || isLeaving(before[position - 1]) ? null : before.filter((e) => !isLeaving(e)).length - 1,
    isCollapsing: isCollapsing(entry) || before.every(isCollapsing),
    isEntering: entry.state === "entering" || before.every((item) => item.state === "entering"),
  };
}

/**
 * The removal rules, for the tiles that stay in one split:
 * 1. A `"grow"` tile stays: it takes the space.
 * 2. Else a `"static"` tile stays: the removed tile holds its place.
 * 3. Else all stay `"pack"`: they slide to the start.
 * A tile that is not `"grow"` and has a share size keeps its pixel size.
 */
export function planRemoval(siblings: readonly RemovalSibling[]): RemovalPlan {
  const hasGrow = siblings.some((sibling) => sibling.flex === "grow");
  const hasStatic = siblings.some((sibling) => sibling.flex === "static");
  return {
    mode: !hasGrow && hasStatic ? "hold" : "collapse",
    frozen: siblings.map((sibling) =>
      sibling.flex !== "grow" && sibling.isShare ? Math.round(sibling.px) : undefined,
    ),
  };
}

/** Stores the plan. `leavingPx` has the pixel size of each leaving tile, by key. */
export function applyPlan(
  presence: Presence,
  plan: RemovalPlan,
  leavingPx: Readonly<Record<string, number>>,
): Presence {
  const frozen = plan.frozen.reduce<Record<string, number>>(
    (all, px, index) => (px === undefined ? all : { ...all, [childKey(presence.children[index], index)]: px }),
    { ...presence.frozen },
  );
  const leaving = presence.leaving.map((tile): LeavingTile => {
    if (tile.mode !== undefined) return tile;
    const px = leavingPx[tile.key];
    return plan.mode === "hold" && px !== undefined ? { ...tile, mode: "hold", px } : { ...tile, mode: "collapse" };
  });
  return { ...presence, leaving, frozen };
}

/** Ends a leaving tile. A held tile stays until its spacer arrives. */
export function finishLeaving(presence: Presence, key: string): Presence {
  const leaving = presence.leaving.flatMap((tile): LeavingTile[] => {
    if (tile.key !== key) return [tile];
    return tile.mode === "hold" ? [{ ...tile, isDone: true }] : [];
  });
  return { ...presence, leaving };
}

/** The layout edits for the sizes and the spacers, or `undefined` when nothing needs to be written back. */
export function buildPatch(presence: Presence, entries: readonly PresenceEntry[]): SplitPatch | undefined {
  const sizes = presence.children.map((child, index) => {
    const px = presence.frozen[childKey(child, index)];
    return px === undefined ? undefined : toPx(px);
  });
  const spacers = entries.flatMap((entry, position) => {
    const leaving = presence.leaving.find((item) => item.key === entry.key);
    if (!leaving?.isDone || leaving.px === undefined || leaving.tile.id === undefined) return [];
    const at = entries.slice(0, position).filter((item) => item.state !== "leaving").length;
    const tile: SpacerTile = { id: leaving.tile.id, spacer: true, size: toPx(leaving.px) };
    return [{ at, tile }];
  });
  return sizes.every((size) => size === undefined) && spacers.length === 0 ? undefined : { sizes, spacers };
}

function leavingEntry(leaving: LeavingTile): PresenceEntry {
  return {
    key: leaving.key,
    tile: leaving.mode === "hold" ? withPixelSize(leaving.tile, leaving.px) : leaving.tile,
    index: leaving.index,
    state: "leaving",
    mode: leaving.mode,
    isFrozen: false,
  };
}

function withPixelSize(tile: Tile, px: number | undefined): Tile {
  return px === undefined ? tile : { ...tile, size: toPx(px) };
}

function toPx(px: number): CssLength {
  return `${px}px`;
}
