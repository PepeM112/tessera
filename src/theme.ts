import type { CSSProperties } from "react";

/** Any CSS value. A number is px. */
export type CssValue = string | number;

/**
 * Each key is set as a `--tessera-*` CSS variable on the Workspace root, so plain CSS can set the same values.
 * A key that is not set uses the default in `styles.css`.
 */
export interface WorkspaceTheme {
  background?: string;
  padding?: CssValue;
  gap?: CssValue;
  radius?: CssValue;
  tileBackground?: string;
  tileBorder?: string;
  /** Shadow of a tile with no `elevation`. */
  tileShadow?: string;
  /** The shadows of tile `elevation` 1 to 4. */
  elevation1?: string;
  elevation2?: string;
  elevation3?: string;
  elevation4?: string;
  /** CSS time, for example `"240ms"`. */
  transitionDuration?: string;
  /** CSS easing function, for example `"ease-out"`. */
  transitionEasing?: string;
  dividerColor?: string;
  /** Colour of a resizable divider on hover, focus and drag. */
  dividerActiveColor?: string;
}

type CssVariables = Record<`--tessera-${string}`, string>;

const THEME_VARIABLES = {
  background: "--tessera-background",
  padding: "--tessera-padding",
  gap: "--tessera-gap",
  radius: "--tessera-radius",
  tileBackground: "--tessera-tile-background",
  tileBorder: "--tessera-tile-border",
  tileShadow: "--tessera-tile-shadow",
  elevation1: "--tessera-elevation-1",
  elevation2: "--tessera-elevation-2",
  elevation3: "--tessera-elevation-3",
  elevation4: "--tessera-elevation-4",
  transitionDuration: "--tessera-transition-duration",
  transitionEasing: "--tessera-transition-easing",
  dividerColor: "--tessera-divider-color",
  dividerActiveColor: "--tessera-divider-active-color",
} as const satisfies Record<keyof WorkspaceTheme, `--tessera-${string}`>;

const THEME_KEYS = Object.keys(THEME_VARIABLES).filter(isThemeKey);

export function themeToStyle(theme: WorkspaceTheme | undefined): CSSProperties {
  if (!theme) return {};
  return THEME_KEYS.reduce<CssVariables>((style, key) => {
    const value = theme[key];
    return value === undefined ? style : { ...style, [THEME_VARIABLES[key]]: toCssValue(value) };
  }, {});
}

export function toCssValue(value: CssValue): string {
  return typeof value === "number" ? `${value}px` : value;
}

function isThemeKey(key: string): key is keyof WorkspaceTheme {
  return Object.hasOwn(THEME_VARIABLES, key);
}
