import { isCssLength, isShare, type CssLength, type SplitDirection, type TileSize } from "./size";

import type { ComponentType } from "react";

/** The props a layout gives to a module. They become the component's React props. */
export type ModuleProps = object;

interface TileBase {
  id?: string;
  size?: TileSize;
  minSize?: CssLength;
  /** Overrides the theme's `tileBackground` for this tile. */
  background?: string;
}

/** A tile that holds a module: the React component `modules[module]`, rendered with `props`. */
export interface ModuleTile extends TileBase {
  module: string;
  props?: ModuleProps;
}

/** A tile divided into child tiles in a row or a column. */
export interface SplitTile extends TileBase {
  split: SplitDirection;
  children: Tile[];
  /** Makes the dividers between the children draggable. Default: `false`. */
  resizable?: boolean;
}

export type Tile = ModuleTile | SplitTile;

export interface Layout {
  version?: 1;
  root: Tile;
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

type TypedModuleTile<M extends ModuleMap> = {
  [K in keyof M & string]: TileBase & { module: K } & PropsField<PropsOf<M[K]>>;
}[keyof M & string];

interface TypedSplitTile<M extends ModuleMap> extends TileBase {
  split: SplitDirection;
  children: TypedTile<M>[];
  resizable?: boolean;
}

type TypedTile<M extends ModuleMap> = TypedModuleTile<M> | TypedSplitTile<M>;

/** A layout whose module ids and props are checked against a module map. */
export interface TypedLayout<M extends ModuleMap> {
  version?: 1;
  root: TypedTile<M>;
}

type Report = (path: string, message: string) => void;

const LAYOUT_KEYS = ["version", "root"];
const BASE_KEYS = ["id", "size", "minSize", "background"];
const MODULE_KEYS = ["module", "props", ...BASE_KEYS];
const SPLIT_KEYS = ["split", "children", "resizable", ...BASE_KEYS];

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

export function childPath(path: string, index: number): string {
  return path === "" ? String(index) : `${path}.${index}`;
}

function parseTile(raw: unknown, path: string, report: Report): Tile | undefined {
  if (!isRecord(raw)) {
    report(path, "Expected an object");
    return undefined;
  }
  const hasSplit = "split" in raw;
  const hasModule = "module" in raw;
  if (hasSplit && hasModule) {
    report(path, 'Use "module" or "split", not both');
    return undefined;
  }
  if (hasSplit) return parseSplitTile(raw, path, report);
  if (hasModule) return parseModuleTile(raw, path, report);
  report(path, 'Expected a "module" or a "split" key');
  return undefined;
}

function parseModuleTile(raw: Record<string, unknown>, path: string, report: Report): ModuleTile {
  reportUnknownKeys(raw, MODULE_KEYS, path, report);
  const { module, props } = raw;
  if (!isNonEmptyString(module)) report(at(path, "module"), "Expected a module id (a non-empty string)");
  if (props !== undefined && !isRecord(props)) report(at(path, "props"), "Expected an object");

  return {
    module: typeof module === "string" ? module : "",
    ...(isRecord(props) ? { props } : {}),
    ...parseTileBase(raw, path, report),
  };
}

function parseSplitTile(raw: Record<string, unknown>, path: string, report: Report): SplitTile {
  reportUnknownKeys(raw, SPLIT_KEYS, path, report);
  const { split, children, resizable } = raw;
  if (split !== "row" && split !== "column") report(at(path, "split"), 'Expected "row" or "column"');
  if (!Array.isArray(children) || children.length === 0) {
    report(at(path, "children"), "Expected an array with at least one tile");
  }
  if (resizable !== undefined && typeof resizable !== "boolean") report(at(path, "resizable"), "Expected a boolean");

  const tiles = Array.isArray(children)
    ? children.map((child: unknown, i) => parseTile(child, `${path}.children[${i}]`, report)).filter(isDefined)
    : [];
  return {
    split: split === "column" ? "column" : "row",
    children: tiles,
    ...(resizable === true ? { resizable } : {}),
    ...parseTileBase(raw, path, report),
  };
}

function parseTileBase(raw: Record<string, unknown>, path: string, report: Report): TileBase {
  const { id, size, minSize, background } = raw;
  const isSizeValid = size === undefined || isShare(size) || isCssLength(size);
  if (id !== undefined && !isNonEmptyString(id)) report(at(path, "id"), "Expected a non-empty string");
  if (!isSizeValid) report(at(path, "size"), 'Expected a number above 0 or a CSS length ("240px", "30%", "20rem")');
  if (minSize !== undefined && !isCssLength(minSize)) {
    report(at(path, "minSize"), 'Expected a CSS length ("48px", "10%", "3rem")');
  }
  if (background !== undefined && !isNonEmptyString(background)) {
    report(at(path, "background"), "Expected a CSS colour or background");
  }

  return {
    ...(isNonEmptyString(id) ? { id } : {}),
    ...(isShare(size) || isCssLength(size) ? { size } : {}),
    ...(isCssLength(minSize) ? { minSize } : {}),
    ...(isNonEmptyString(background) ? { background } : {}),
  };
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

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
