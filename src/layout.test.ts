import { describe, expect, it } from "vitest";

import { getTileAt, parseLayout, withSplitSizes, type Layout } from "./layout";

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

describe("getTileAt", () => {
  it("finds a tile by its path, or nothing", () => {
    expect(getTileAt(SIDEBAR.root, "")).toBe(SIDEBAR.root);
    expect(getTileAt(SIDEBAR.root, "1.0")).toMatchObject({ module: "main" });
    expect(getTileAt(SIDEBAR.root, "0.0")).toBeUndefined();
  });
});
