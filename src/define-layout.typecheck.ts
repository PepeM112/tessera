// Type test for defineLayout (C8): `make check` fails if one of the @ts-expect-error lines stops being an error.
import { memo } from "react";

import { defineLayout, type Layout } from "./layout";

interface NoteProps {
  label: string;
  isPinned?: boolean;
}

function Note({ label }: NoteProps) {
  return label;
}

function Clock() {
  return null;
}

const modules = { note: Note, clock: Clock, memoNote: memo(Note) };

export const LAYOUTS: Layout[] = [
  defineLayout(modules, {
    root: {
      split: "row",
      resizable: true,
      children: [
        { module: "clock", size: "240px" },
        { module: "note", props: { label: "x", isPinned: true }, size: 2 },
        { module: "memoNote", props: { label: "y" }, minSize: "10rem" },
      ],
    },
  }),
  // @ts-expect-error the module id is not in the module map
  defineLayout(modules, { root: { module: "calendar" } }),
  // @ts-expect-error a required prop is missing
  defineLayout(modules, { root: { module: "note" } }),
  // @ts-expect-error a prop has the wrong type
  defineLayout(modules, { root: { module: "note", props: { label: 1 } } }),
  // @ts-expect-error memo components are checked too
  defineLayout(modules, { root: { module: "memoNote", props: { label: false } } }),
  // @ts-expect-error a size string must be a CSS length
  defineLayout(modules, { root: { module: "clock", size: "wide" } }),
  defineLayout(modules, {
    root: {
      split: "column",
      children: [
        { module: "note", props: { label: "x" }, id: "a", flex: "pack", elevation: 2, radius: 12, borderColor: "red" },
        { spacer: true, size: "48px" },
        { windows: [{ module: "clock" }, { module: "note", props: { label: "y" } }], flex: "static" },
      ],
    },
  }),
  // @ts-expect-error a module id inside windows must be in the module map
  defineLayout(modules, { root: { windows: [{ module: "calendar" }] } }),
  // @ts-expect-error a required prop inside windows is missing
  defineLayout(modules, { root: { windows: [{ module: "note" }] } }),
  // @ts-expect-error a prop inside windows has the wrong type
  defineLayout(modules, { root: { windows: [{ module: "note", props: { label: 1 } }] } }),
  // @ts-expect-error windows needs at least one window
  defineLayout(modules, { root: { windows: [] } }),
  // @ts-expect-error a tile has module or windows, not both
  defineLayout(modules, { root: { module: "clock", windows: [{ module: "clock" }] } }),
  // @ts-expect-error flex must be grow, static or pack
  defineLayout(modules, { root: { module: "clock", flex: "shrink" } }),
  // @ts-expect-error elevation goes from 0 to 4
  defineLayout(modules, { root: { module: "clock", elevation: 5 } }),
  // @ts-expect-error a spacer has no module
  defineLayout(modules, { root: { split: "row", children: [{ spacer: true, module: "clock" }] } }),
];
