import type { CSSProperties } from "react";

export type SplitDirection = "row" | "column";

export type LengthUnit = "px" | "%" | "rem" | "em" | "vw" | "vh";

/** A CSS length, as for `width` or `height`: `"240px"`, `"30%"`, `"20rem"`. */
export type CssLength = `${number}${LengthUnit}`;

/** A number is a share of the free space (like `flex-grow`). A string is a fixed CSS length. */
export type TileSize = number | CssLength;

/** The values that turn a CSS length into px. `containerPx` is the split's inner size on its main axis. */
export interface LengthContext {
  containerPx: number;
  rootFontPx: number;
  fontPx: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface ResizeInput {
  sizes: readonly (TileSize | undefined)[];
  pixels: readonly number[];
  minPixels: readonly number[];
  /** The divider between child `index` and child `index + 1`. */
  index: number;
  delta: number;
  context: LengthContext;
}

export const DEFAULT_SHARE = 1;
export const DEFAULT_RESIZABLE_MIN_SIZE: CssLength = "48px";

const LENGTH_PATTERN = /^(\d+(?:\.\d+)?|\.\d+)(px|%|rem|em|vw|vh)$/;

const UNIT_TO_PX: Record<LengthUnit, (value: number, context: LengthContext) => number> = {
  px: (value) => value,
  "%": (value, context) => (value / 100) * context.containerPx,
  rem: (value, context) => value * context.rootFontPx,
  em: (value, context) => value * context.fontPx,
  vw: (value, context) => (value / 100) * context.viewportWidth,
  vh: (value, context) => (value / 100) * context.viewportHeight,
};

const MIN_SIZE_PROPERTY: Record<SplitDirection, "minWidth" | "minHeight"> = { row: "minWidth", column: "minHeight" };

export function isShare(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isCssLength(value: unknown): value is CssLength {
  return typeof value === "string" && LENGTH_PATTERN.test(value);
}

export function lengthToPx(length: CssLength, context: LengthContext): number {
  const { value, unit } = splitLength(length);
  return UNIT_TO_PX[unit](value, context);
}

/**
 * Flex item style of a tile in a split, the same as CSS flexbox: a share grows from a basis of 0, a length is
 * the basis and can shrink when the space is too small.
 */
export function tileFlexStyle(
  size: TileSize | undefined,
  minSize: CssLength | undefined,
  direction: SplitDirection | undefined,
): CSSProperties {
  const flex = typeof size === "string" ? `0 1 ${size}` : `${size ?? DEFAULT_SHARE} 1 0`;
  if (!minSize || !direction) return { flex };
  return { flex, [MIN_SIZE_PROPERTY[direction]]: minSize };
}

/**
 * Moves one divider by `delta` px and returns the new sizes of all children. Only the two children next to the
 * divider change. Each one keeps its unit: px stays px, % stays %, a share stays a share. Other units become px.
 */
export function resizePair({ sizes, pixels, minPixels, index, delta, context }: ResizeInput): TileSize[] {
  const after = index + 1;
  const total = pixels[index] + pixels[after];
  const lowest = minPixels[index];
  const highest = total - minPixels[after];
  const current = sizes.map((size) => size ?? DEFAULT_SHARE);
  if (total <= 0 || highest < lowest) return current;

  const nextBefore = Math.min(highest, Math.max(lowest, pixels[index] + delta));
  const nextPixels = pixels.map((px, i) => (i === index ? nextBefore : i === after ? total - nextBefore : px));
  const before = current[index];
  const next = current[after];

  if (typeof before === "number" && typeof next === "number") {
    const share = roundShare(((before + next) * nextBefore) / total);
    return current.map((size, i) => (i === index ? share : i === after ? roundShare(before + next - share) : size));
  }

  const isOtherShare = (i: number): boolean => i !== index && i !== after && typeof current[i] === "number";
  const shareTotal = sum(current.map((size, i) => (isOtherShare(i) && typeof size === "number" ? size : 0)));
  const shareTotalPx = sum(pixels.map((px, i) => (isOtherShare(i) ? px : 0)));

  const resizeOne = (size: TileSize, px: number): TileSize => {
    if (typeof size === "string") return pxToLength(px, size, context);
    // The only share takes all the free space, so its value does not change.
    if (shareTotal <= 0 || shareTotalPx <= 0) return size;
    return roundShare((shareTotal * px) / shareTotalPx);
  };

  return current.map((size, i) => (i === index || i === after ? resizeOne(size, nextPixels[i]) : size));
}

function pxToLength(px: number, previous: CssLength, context: LengthContext): CssLength {
  if (splitLength(previous).unit === "%" && context.containerPx > 0) {
    return `${Math.round((px / context.containerPx) * 10000) / 100}%`;
  }
  return `${Math.round(px)}px`;
}

function splitLength(length: CssLength): { value: number; unit: LengthUnit } {
  const match = LENGTH_PATTERN.exec(length);
  const unit = match?.[2] ?? "px";
  return { value: Number(match?.[1] ?? 0), unit: isLengthUnit(unit) ? unit : "px" };
}

function isLengthUnit(text: string): text is LengthUnit {
  return Object.hasOwn(UNIT_TO_PX, text);
}

function roundShare(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
