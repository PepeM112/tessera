import { isCssLength, isShare, type CssLength, type SplitDirection, type TileSize } from "./size";

import type { CssValue } from "./theme";
import type { ComponentType } from "react";

/** The props a layout gives to a module. They become the component's React props. */
export type ModuleProps = object;

const TILE_FLEXES = ["grow", "static", "pack"] as const;

/** What a tile does when a sibling is removed: take the free space, keep its place, or slide to close the gap. */
export type TileFlex = (typeof TILE_FLEXES)[number];

const TILE_ELEVATIONS = [0, 1, 2, 3, 4] as const;

/** Shadow level of a tile: `0` is no shadow, `1` to `4` use the theme's elevation scale. */
export type TileElevation = (typeof TILE_ELEVATIONS)[number];

interface TileIdentity {
  /** Keeps the tile (and its module state) when a sibling is removed. Must be unique among siblings. */
  id?: string;
  size?: TileSize;
}

interface TileBase extends TileIdentity {
  minSize?: CssLength;
  /** What the tile does when a sibling is removed. Default: `"grow"`. */
  flex?: TileFlex;
  /** Overrides the theme's `tileBackground` for this tile. */
  background?: string;
}

/** The look of a module tile. A value that is not set uses the theme. */
export interface TileAppearance {
  /** Corner radius. A number is px. */
  radius?: CssValue;
  /** Border width. A number is px. */
  borderWidth?: CssValue;
  borderColor?: string;
  elevation?: TileElevation;
}

/** A tile that holds a module: the React component `modules[module]`, rendered with `props`. */
export interface ModuleTile extends TileBase, TileAppearance {
  module: string;
  props?: ModuleProps;
}

/** One module in a tile with windows. */
export interface WindowConfig {
  module: string;
  props?: ModuleProps;
}

/** A tile that holds several modules side by side. The user scrolls between them. */
export interface WindowsTile extends TileBase, TileAppearance {
  /** At least one. */
  windows: WindowConfig[];
}

/** An empty, invisible tile. It holds the place of a removed tile. */
export interface SpacerTile extends TileIdentity {
  spacer: true;
}

/** A tile divided into child tiles in a row or a column. */
export interface SplitTile extends TileBase {
  split: SplitDirection;
  children: Tile[];
  /** Makes the dividers between the children draggable. Default: `false`. */
  resizable?: boolean;
}

export type Tile = ModuleTile | WindowsTile | SplitTile | SpacerTile;

export interface Layout {
  version?: 1;
  root: Tile;
}

/** The edits that one split needs after a removal: frozen sizes and the spacers of held tiles. */
export interface SplitPatch {
  /** The new size of each child. `undefined`: the size does not change. */
  sizes: readonly (CssLength | undefined)[];
  /** `at` is an index in the children without the spacers. Sorted. */
  spacers: readonly { at: number; tile: SpacerTile }[];
}

export interface LayoutError {
  /** Where the error is, for example `root.children[1].size`. */
  path: string;
  message: string;
}

export type ParseLayoutResult = { ok: true; layout: Layout } | { ok: false; errors: LayoutError[] };

/** The modules a Workspace can render: module id → React component. */
export type ModuleMap = Readonly<Record<string, ComponentType<never>>>;

type PropsOf<C> = C extends ComponentType<infer P> ? P : never;

// A component without a props parameter infers `unknown`: it takes no props.
type PropsField<P> = unknown extends P
  ? { props?: Record<string, never> }
  : Partial<P> extends P
    ? { props?: P }
    : { props: P };

type TypedWindow<M extends ModuleMap> = {
  [K in keyof M & string]: { module: K } & PropsField<PropsOf<M[K]>>;
}[keyof M & string];

type TypedModuleTile<M extends ModuleMap> = {
  [K in keyof M & string]: TileBase & TileAppearance & { module: K; windows?: never } & PropsField<PropsOf<M[K]>>;
}[keyof M & string];

interface TypedWindowsTile<M extends ModuleMap> extends TileBase, TileAppearance {
  windows: [TypedWindow<M>, ...TypedWindow<M>[]];
  module?: never;
  props?: never;
}

// The `never` keys make a spacer with a module an error: TypeScript allows a key of any union member otherwise.
type TypedSpacerTile = SpacerTile & { module?: never; windows?: never; split?: never };

interface TypedSplitTile<M extends ModuleMap> extends TileBase {
  split: SplitDirection;
  children: TypedTile<M>[];
  resizable?: boolean;
}

type TypedTile<M extends ModuleMap> = TypedModuleTile<M> | TypedWindowsTile<M> | TypedSplitTile<M> | TypedSpacerTile;

/** A layout whose module ids and props are checked against a module map. */
export interface TypedLayout<M extends ModuleMap> {
  version?: 1;
  root: TypedTile<M>;
}

type Report = (path: string, message: string) => void;

const LAYOUT_KEYS = ["version", "root"];
const BASE_KEYS = ["id", "size", "minSize", "flex", "background"];
const APPEARANCE_KEYS = ["radius", "borderWidth", "borderColor", "elevation"];
const MODULE_KEYS = ["module", "props", ...BASE_KEYS, ...APPEARANCE_KEYS];
const WINDOWS_KEYS = ["windows", ...BASE_KEYS, ...APPEARANCE_KEYS];
const WINDOW_KEYS = ["module", "props"];
const SPLIT_KEYS = ["split", "children", "resizable", ...BASE_KEYS];
const SPACER_KEYS = ["spacer", "id", "size"];

/** Type-checks a layout written in TypeScript: each `module` must be a key of `modules`, with its props. */
export function defineLayout<M extends ModuleMap>(_modules: M, layout: TypedLayout<M>): TypedLayout<M> {
  return layout;
}

/** Validates raw data (for example parsed JSON) and returns a typed layout, or every error with its path. */
export function parseLayout(raw: unknown): ParseLayoutResult {
  const errors: LayoutError[] = [];
  const report: Report = (path, message) => {
    errors.push({ path, message });
  };

  if (!isRecord(raw)) return { ok: false, errors: [{ path: "layout", message: "Expected an object" }] };
  reportUnknownKeys(raw, LAYOUT_KEYS, "", report);
  if (raw.version !== undefined && raw.version !== 1) report("version", "Expected 1");
  if (raw.root === undefined) report("root", "Required");

  const root = raw.root === undefined ? undefined : parseTile(raw.root, "root", report);
  if (!root || errors.length > 0) return { ok: false, errors };
  return { ok: true, layout: raw.version === 1 ? { version: 1, root } : { root } };
}

export function isSplitTile(tile: Tile): tile is SplitTile {
  return "split" in tile;
}

export function isSpacerTile(tile: Tile): tile is SpacerTile {
  return "spacer" in tile;
}

export function hasWindows(tile: Tile): tile is WindowsTile {
  return "windows" in tile;
}

/** `path` is the child indexes from the root, joined with dots. The root is `""`. */
export function getTileAt(root: Tile, path: string): Tile | undefined {
  return toIndexes(path).reduce<Tile | undefined>(
    (tile, index) => (tile && isSplitTile(tile) ? tile.children[index] : undefined),
    root,
  );
}

/** Returns a new layout where the split at `path` has the given child sizes. Other tiles keep their identity. */
export function withSplitSizes(layout: Layout, path: string, sizes: readonly (TileSize | undefined)[]): Layout {
  const root = updateSplitAt(layout.root, toIndexes(path), (split) => {
    const children = split.children.map((child, i) => withSize(child, sizes[i]));
    return isSameList(children, split.children) ? split : { ...split, children };
  });
  return root === layout.root ? layout : { ...layout, root };
}

/** Returns a new layout where the split at `path` has the patch applied: first the sizes, then the spacers. */
export function withSplitPatch(layout: Layout, path: string, patch: SplitPatch): Layout {
  const root = updateSplitAt(layout.root, toIndexes(path), (split) => {
    const sized = split.children.map((child, i) => withSize(child, patch.sizes[i] ?? child.size));
    const children = patch.spacers.reduce<Tile[]>((list, { at, tile }, n) => list.toSpliced(at + n, 0, tile), sized);
    return isSameList(children, split.children) ? split : { ...split, children };
  });
  return root === layout.root ? layout : { ...layout, root };
}

export function childPath(path: string, index: number): string {
  return path === "" ? String(index) : `${path}.${index}`;
}

function parseTile(raw: unknown, path: string, report: Report): Tile | undefined {
  if (!isRecord(raw)) {
    report(path, "Expected an object");
    return undefined;
  }
  if ("spacer" in raw) return parseSpacerTile(raw, path, report);
  const hasSplit = "split" in raw;
  const hasModule = "module" in raw;
  const hasWindowList = "windows" in raw;
  if (hasSplit && (hasModule || hasWindowList)) {
    report(path, 'Use "module", "windows" or "split", not more than one');
    return undefined;
  }
  if (hasModule && hasWindowList) {
    report(path, 'Use "module" with "props", or "windows", not both');
    return undefined;
  }
  if (hasSplit) return parseSplitTile(raw, path, report);
  if (hasModule) return parseModuleTile(raw, path, report);
  if (hasWindowList) return parseWindowsTile(raw, path, report);
  report(path, 'Expected a "module", "windows", "split" or "spacer" key');
  return undefined;
}

function parseSpacerTile(raw: Record<string, unknown>, path: string, report: Report): SpacerTile {
  reportUnknownKeys(raw, SPACER_KEYS, path, report);
  if (raw.spacer !== true) report(at(path, "spacer"), "Expected true");
  return { spacer: true, ...parseTileIdentity(raw, path, report) };
}

function parseModuleTile(raw: Record<string, unknown>, path: string, report: Report): ModuleTile {
  reportUnknownKeys(raw, MODULE_KEYS, path, report);
  const { module, props } = parseModuleRef(raw, path, report);
  return {
    module,
    ...(props ? { props } : {}),
    ...parseTileBase(raw, path, report),
    ...parseAppearance(raw, path, report),
  };
}

function parseWindowsTile(raw: Record<string, unknown>, path: string, report: Report): WindowsTile {
  reportUnknownKeys(raw, WINDOWS_KEYS, path, report);
  const { windows } = raw;
  if (!Array.isArray(windows) || windows.length === 0) {
    report(at(path, "windows"), "Expected an array with at least one window");
  }
  return {
    windows: Array.isArray(windows)
      ? windows.map((item: unknown, i) => parseWindow(item, `${at(path, "windows")}[${i}]`, report))
      : [],
    ...parseTileBase(raw, path, report),
    ...parseAppearance(raw, path, report),
  };
}

function parseWindow(raw: unknown, path: string, report: Report): WindowConfig {
  if (!isRecord(raw)) {
    report(path, "Expected an object");
    return { module: "" };
  }
  reportUnknownKeys(raw, WINDOW_KEYS, path, report);
  const { module, props } = parseModuleRef(raw, path, report);
  return { module, ...(props ? { props } : {}) };
}

function parseModuleRef(
  raw: Record<string, unknown>,
  path: string,
  report: Report,
): { module: string; props: ModuleProps | undefined } {
  const { module, props } = raw;
  if (!isNonEmptyString(module)) report(at(path, "module"), "Expected a module id (a non-empty string)");
  if (props !== undefined && !isRecord(props)) report(at(path, "props"), "Expected an object");
  return { module: typeof module === "string" ? module : "", props: isRecord(props) ? props : undefined };
}

function parseSplitTile(raw: Record<string, unknown>, path: string, report: Report): SplitTile {
  reportUnknownKeys(raw, SPLIT_KEYS, path, report);
  const { split, children, resizable } = raw;
  if (split !== "row" && split !== "column") report(at(path, "split"), 'Expected "row" or "column"');
  if (!Array.isArray(children) || children.length === 0) {
    report(at(path, "children"), "Expected an array with at least one tile");
  }
  if (resizable !== undefined && typeof resizable !== "boolean") report(at(path, "resizable"), "Expected a boolean");

  const parsed = Array.isArray(children)
    ? children.map((child: unknown, i) => parseTile(child, `${path}.children[${i}]`, report))
    : [];
  reportDuplicateIds(parsed, path, report);
  const tiles = parsed.filter(isDefined);
  return {
    split: split === "column" ? "column" : "row",
    children: tiles,
    ...(resizable === true ? { resizable } : {}),
    ...parseTileBase(raw, path, report),
  };
}

function parseTileIdentity(raw: Record<string, unknown>, path: string, report: Report): TileIdentity {
  const { id, size } = raw;
  const isSizeValid = size === undefined || isShare(size) || isCssLength(size);
  if (id !== undefined && !isNonEmptyString(id)) report(at(path, "id"), "Expected a non-empty string");
  if (!isSizeValid) report(at(path, "size"), 'Expected a number above 0 or a CSS length ("240px", "30%", "20rem")');

  return {
    ...(isNonEmptyString(id) ? { id } : {}),
    ...(isShare(size) || isCssLength(size) ? { size } : {}),
  };
}

function parseTileBase(raw: Record<string, unknown>, path: string, report: Report): TileBase {
  const { minSize, flex, background } = raw;
  const identity = parseTileIdentity(raw, path, report);
  if (minSize !== undefined && !isCssLength(minSize)) {
    report(at(path, "minSize"), 'Expected a CSS length ("48px", "10%", "3rem")');
  }
  if (flex !== undefined && !isTileFlex(flex)) report(at(path, "flex"), 'Expected "grow", "static" or "pack"');
  if (background !== undefined && !isNonEmptyString(background)) {
    report(at(path, "background"), "Expected a CSS colour or background");
  }

  return {
    ...identity,
    ...(isCssLength(minSize) ? { minSize } : {}),
    ...(isTileFlex(flex) ? { flex } : {}),
    ...(isNonEmptyString(background) ? { background } : {}),
  };
}

function parseAppearance(raw: Record<string, unknown>, path: string, report: Report): TileAppearance {
  const { radius, borderWidth, borderColor, elevation } = raw;
  if (radius !== undefined && !isCssValue(radius)) {
    report(at(path, "radius"), 'Expected a number of 0 or more (px) or a CSS length ("12px", "1rem")');
  }
  if (borderWidth !== undefined && !isCssValue(borderWidth)) {
    report(at(path, "borderWidth"), 'Expected a number of 0 or more (px) or a CSS length ("2px")');
  }
  if (borderColor !== undefined && !isNonEmptyString(borderColor)) {
    report(at(path, "borderColor"), "Expected a CSS colour");
  }
  if (elevation !== undefined && !isTileElevation(elevation)) report(at(path, "elevation"), "Expected 0, 1, 2, 3 or 4");

  return {
    ...(isCssValue(radius) ? { radius } : {}),
    ...(isCssValue(borderWidth) ? { borderWidth } : {}),
    ...(isNonEmptyString(borderColor) ? { borderColor } : {}),
    ...(isTileElevation(elevation) ? { elevation } : {}),
  };
}

function reportDuplicateIds(tiles: readonly (Tile | undefined)[], path: string, report: Report) {
  tiles.forEach((tile, i) => {
    const id = tile?.id;
    if (id === undefined) return;
    const first = tiles.findIndex((other) => other?.id === id);
    if (first < i) report(`${path}.children[${i}].id`, `Duplicate id "${id}" (first used by children[${first}])`);
  });
}

function reportUnknownKeys(raw: Record<string, unknown>, allowed: readonly string[], path: string, report: Report) {
  Object.keys(raw)
    .filter((key) => !allowed.includes(key))
    .forEach((key) => report(at(path, key), "Unknown key"));
}

function updateSplitAt(tile: Tile, indexes: readonly number[], update: (split: SplitTile) => SplitTile): Tile {
  if (!isSplitTile(tile)) return tile;
  const [head, ...rest] = indexes;
  if (head === undefined) return update(tile);
  const children = tile.children.map((child, i) => (i === head ? updateSplitAt(child, rest, update) : child));
  return isSameList(children, tile.children) ? tile : { ...tile, children };
}

function isSameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

function withSize(tile: Tile, size: TileSize | undefined): Tile {
  if (tile.size === size) return tile;
  const next = { ...tile };
  delete next.size;
  return size === undefined ? next : { ...next, size };
}

function toIndexes(path: string): number[] {
  return path === "" ? [] : path.split(".").map(Number);
}

function at(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCssValue(value: unknown): value is CssValue {
  return (typeof value === "number" && Number.isFinite(value) && value >= 0) || isNonEmptyString(value);
}

function isTileFlex(value: unknown): value is TileFlex {
  return TILE_FLEXES.some((flex) => flex === value);
}

function isTileElevation(value: unknown): value is TileElevation {
  return TILE_ELEVATIONS.some((elevation) => elevation === value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
