import { describe, expect, it } from "vitest";

import { getTileAt, hasWindows, isSpacerTile, parseLayout, withSplitSizes, type Layout } from "./layout";

const SIDEBAR: Layout = {
  version: 1,
  root: {
    split: "row",
    resizable: true,
    children: [
      { module: "nav", size: "240px" },
      {
        split: "column",
        children: [
          { module: "main", size: 3, props: { title: "Main" } },
          { module: "info", size: 1, background: "transparent" },
        ],
      },
    ],
  },
};

function errorsOf(raw: unknown): { path: string; message: string }[] {
  const result = parseLayout(raw);
  return result.ok ? [] : result.errors;
}

function errorPaths(raw: unknown): string[] {
  return errorsOf(raw).map((error) => error.path);
}

describe("parseLayout", () => {
  it("accepts a valid layout and gives back the same data", () => {
    expect(parseLayout(JSON.parse(JSON.stringify(SIDEBAR)))).toEqual({ ok: true, layout: SIDEBAR });
  });

  it("accepts a layout without a version", () => {
    expect(parseLayout({ root: { module: "note" } })).toEqual({ ok: true, layout: { root: { module: "note" } } });
  });

  it("refuses input that is not an object", () => {
    expect(errorPaths(null)).toEqual(["layout"]);
    expect(errorPaths([])).toEqual(["layout"]);
  });

  it("refuses a missing root and a wrong version", () => {
    expect(errorPaths({ version: 2 })).toEqual(["version", "root"]);
  });

  it("refuses wrong types with the path of each error", () => {
    const raw = {
      root: {
        split: "diagonal",
        resizable: "yes",
        children: [
          { module: "", props: [] },
          { module: "note", size: 0, minSize: 48, id: 7, background: "" },
        ],
      },
    };
    expect(errorPaths(raw)).toEqual([
      "root.split",
      "root.resizable",
      "root.children[0].module",
      "root.children[0].props",
      "root.children[1].id",
      "root.children[1].size",
      "root.children[1].minSize",
      "root.children[1].background",
    ]);
  });

  it("refuses an empty children array", () => {
    expect(errorPaths({ root: { split: "row", children: [] } })).toEqual(["root.children"]);
  });

  it("refuses bad units", () => {
    const raw = {
      root: {
        split: "row",
        children: [
          { module: "a", size: "240" },
          { module: "b", size: "10pt" },
        ],
      },
    };
    expect(errorPaths(raw)).toEqual(["root.children[0].size", "root.children[1].size"]);
  });

  it("refuses unknown keys and tiles with both or no kind", () => {
    const raw = {
      extra: true,
      root: { split: "row", children: [{ module: "a", sise: 2 }, { module: "a", split: "row" }, { size: 1 }] },
    };
    expect(errorPaths(raw)).toEqual(["extra", "root.children[0].sise", "root.children[1]", "root.children[2]"]);
  });

  it("accepts flex, appearance, a spacer and windows, and gives back the same data", () => {
    const layout: Layout = {
      root: {
        split: "row",
        children: [
          { module: "a", id: "a", flex: "pack", radius: 12, borderWidth: "2px", borderColor: "red", elevation: 0 },
          { spacer: true, id: "gap", size: "48px" },
          { windows: [{ module: "a" }, { module: "b", props: { x: 1 } }], flex: "static", elevation: 4 },
          { split: "column", flex: "grow", children: [{ module: "a" }] },
        ],
      },
    };
    expect(parseLayout(JSON.parse(JSON.stringify(layout)))).toEqual({ ok: true, layout });
  });

  it("refuses module and windows together, or neither", () => {
    const raw = {
      root: {
        split: "row",
        children: [
          { module: "a", windows: [{ module: "a" }] },
          { props: {} },
          { windows: [{ module: "a" }], props: {} },
        ],
      },
    };
    expect(errorsOf(raw)).toEqual([
      { path: "root.children[0]", message: 'Use "module" with "props", or "windows", not both' },
      { path: "root.children[1]", message: 'Expected a "module", "windows", "split" or "spacer" key' },
      { path: "root.children[2].props", message: "Unknown key" },
    ]);
  });

  it("refuses bad windows with the path of each error", () => {
    const raw = {
      root: {
        split: "row",
        children: [{ windows: [] }, { windows: "x" }, { windows: [{ module: "" }, 3, { module: "a", extra: 1 }] }],
      },
    };
    expect(errorPaths(raw)).toEqual([
      "root.children[0].windows",
      "root.children[1].windows",
      "root.children[2].windows[0].module",
      "root.children[2].windows[1]",
      "root.children[2].windows[2].extra",
    ]);
  });

  it("refuses a bad flex and a bad appearance", () => {
    const raw = {
      root: {
        split: "row",
        children: [
          { module: "a", flex: "shrink" },
          { module: "a", elevation: 5 },
          { module: "a", elevation: "1" },
          { module: "a", radius: -1, borderWidth: "", borderColor: 3 },
          { split: "row", children: [{ module: "a" }], flex: 1 },
        ],
      },
    };
    expect(errorPaths(raw)).toEqual([
      "root.children[0].flex",
      "root.children[1].elevation",
      "root.children[2].elevation",
      "root.children[3].radius",
      "root.children[3].borderWidth",
      "root.children[3].borderColor",
      "root.children[4].flex",
    ]);
  });

  it("refuses appearance keys on a split and a spacer", () => {
    const raw = { root: { split: "row", elevation: 1, children: [{ spacer: true, flex: "grow", background: "red" }] } };
    expect(errorPaths(raw)).toEqual(["root.elevation", "root.children[0].flex", "root.children[0].background"]);
  });

  it("refuses a spacer with extra keys, a bad size or a spacer that is not true", () => {
    const raw = {
      root: {
        split: "row",
        children: [
          { spacer: true, module: "a" },
          { spacer: true, size: "wide" },
          { spacer: false },
          { spacer: true, minSize: "1px" },
        ],
      },
    };
    expect(errorPaths(raw)).toEqual([
      "root.children[0].module",
      "root.children[1].size",
      "root.children[2].spacer",
      "root.children[3].minSize",
    ]);
  });

  it("refuses duplicate ids among siblings, but not in other splits", () => {
    const raw = {
      root: {
        split: "row",
        children: [
          { module: "a", id: "x" },
          { split: "column", id: "y", children: [{ module: "a", id: "x" }] },
          { spacer: true, id: "x" },
          { module: "a" },
          { module: "a" },
        ],
      },
    };
    expect(errorsOf(raw)).toEqual([
      { path: "root.children[2].id", message: 'Duplicate id "x" (first used by children[0])' },
    ]);
  });

  it("gives a clear message", () => {
    expect(errorsOf({ root: { module: "a", size: -1 } })[0].message).toMatch(/CSS length/);
  });
});

describe("withSplitSizes", () => {
  it("sets the sizes of the split at the path and keeps the other tiles", () => {
    const next = withSplitSizes(SIDEBAR, "1", [2, undefined]);
    const column = getTileAt(next.root, "1");
    expect(column).toMatchObject({ children: [{ module: "main", size: 2 }, { module: "info" }] });
    expect(getTileAt(next.root, "1.1")).not.toHaveProperty("size");
    expect(getTileAt(next.root, "0")).toBe(getTileAt(SIDEBAR.root, "0"));
  });

  it("returns the same layout when nothing changes", () => {
    expect(withSplitSizes(SIDEBAR, "", ["240px", undefined])).toBe(SIDEBAR);
  });

  it("gives a layout that parseLayout accepts", () => {
    expect(parseLayout(withSplitSizes(SIDEBAR, "", ["300px", 1.5])).ok).toBe(true);
  });
});

describe("tile guards", () => {
  it("tell a spacer and a tile with windows from other tiles", () => {
    expect(isSpacerTile({ spacer: true })).toBe(true);
    expect(isSpacerTile({ module: "a" })).toBe(false);
    expect(hasWindows({ windows: [{ module: "a" }] })).toBe(true);
    expect(hasWindows({ module: "a" })).toBe(false);
  });
});

describe("getTileAt", () => {
  it("finds a tile by its path, or nothing", () => {
    expect(getTileAt(SIDEBAR.root, "")).toBe(SIDEBAR.root);
    expect(getTileAt(SIDEBAR.root, "1.0")).toMatchObject({ module: "main" });
    expect(getTileAt(SIDEBAR.root, "0.0")).toBeUndefined();
  });
});
