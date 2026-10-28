import { describe, expect, it } from "vitest";

import {
  applyPlan,
  buildPatch,
  describeDivider,
  finishLeaving,
  followChildren,
  initialPresence,
  listEntries,
  planRemoval,
  tileFlex,
  type RemovalSibling,
} from "./tile-presence";

import type { Tile } from "./layout";

const tile = (id: string | undefined, extra: object = {}): Tile => ({
  module: "note",
  ...(id ? { id } : {}),
  ...extra,
});

function stateOf(children: readonly Tile[], next: readonly Tile[]) {
  return followChildren(initialPresence(children), next);
}

function keysOf(children: readonly Tile[], next: readonly Tile[]): string[] {
  const presence = stateOf(children, next);
  return listEntries(presence, next).map((entry) => `${entry.key}:${entry.state}`);
}

describe("followChildren", () => {
  it("returns the same object when the children did not change", () => {
    const children = [tile("a")];
    const presence = initialPresence(children);
    expect(followChildren(presence, children)).toBe(presence);
  });

  it("keeps a removed tile with an id at its place, as leaving", () => {
    expect(keysOf([tile("a"), tile("b"), tile("c")], [tile("a"), tile("c")])).toEqual([
      "id:a:present",
      "id:b:leaving",
      "id:c:present",
    ]);
  });

  it("keeps a first tile that leaves at the start", () => {
    expect(keysOf([tile("a"), tile("b")], [tile("b")])).toEqual(["id:a:leaving", "id:b:present"]);
  });

  it("keeps two neighbours that leave in their order", () => {
    expect(keysOf([tile("a"), tile("b"), tile("c")], [tile("c")])).toEqual([
      "id:a:leaving",
      "id:b:leaving",
      "id:c:present",
    ]);
  });

  it("marks a new tile with an id as entering", () => {
    expect(keysOf([tile("a")], [tile("a"), tile("b")])).toEqual(["id:a:present", "id:b:entering"]);
  });

  it("does not animate a tile without an id", () => {
    expect(keysOf([tile(undefined), tile(undefined)], [tile(undefined)])).toEqual(["index:0:present"]);
    expect(keysOf([tile(undefined)], [tile(undefined), tile(undefined)])).toEqual([
      "index:0:present",
      "index:1:present",
    ]);
  });

  it("brings a leaving tile back when its id returns", () => {
    const first = stateOf([tile("a"), tile("b")], [tile("a")]);
    const second = followChildren(first, [tile("a"), tile("b")]);
    expect(listEntries(second, second.children).map((entry) => `${entry.key}:${entry.state}`)).toEqual([
      "id:a:present",
      "id:b:present",
    ]);
  });

  it("keeps the leaving tiles of an earlier layout", () => {
    const first = stateOf([tile("a"), tile("b"), tile("c")], [tile("a"), tile("c")]);
    const second = followChildren(first, [tile("c")]);
    expect(listEntries(second, second.children).map((entry) => entry.key)).toEqual(["id:a", "id:b", "id:c"]);
  });

  it("clears the frozen sizes when the children change", () => {
    const first = applyPlan(stateOf([tile("a"), tile("b")], [tile("a")]), planRemoval([pack(100)]), {});
    expect(first.frozen).toEqual({ "id:a": 100 });
    expect(followChildren(first, [tile("a")]).frozen).toEqual({});
  });
});

describe("listEntries", () => {
  it("gives a frozen tile its pixel size", () => {
    const children = [tile("a"), tile("b")];
    const presence = applyPlan(stateOf([tile("x"), ...children], children), planRemoval([pack(120), pack(80)]), {});
    expect(listEntries(presence, children).map((entry) => [entry.key, entry.tile.size, entry.isFrozen])).toEqual([
      ["id:x", undefined, false],
      ["id:a", "120px", true],
      ["id:b", "80px", true],
    ]);
  });

  it("gives a held tile its pixel size", () => {
    const children = [tile("a")];
    const presence = applyPlan(stateOf([tile("b"), ...children], children), planRemoval([stat(100)]), { "id:b": 90 });
    const [held] = listEntries(presence, children);
    expect(held).toMatchObject({ key: "id:b", state: "leaving", mode: "hold" });
    expect(held.tile.size).toBe("90px");
  });
});

function sibling(flex: RemovalSibling["flex"], px: number, isShare = true): RemovalSibling {
  return { flex, px, isShare };
}
const grow = (px: number) => sibling("grow", px);
const stat = (px: number) => sibling("static", px);
const pack = (px: number) => sibling("pack", px);

describe("planRemoval", () => {
  it("rule 1: a grow tile takes the space, so the leaving tile collapses", () => {
    expect(planRemoval([grow(200), stat(100)])).toEqual({ mode: "collapse", frozen: [undefined, 100] });
    expect(planRemoval([pack(100), grow(200)])).toEqual({ mode: "collapse", frozen: [100, undefined] });
  });

  it("rule 1 wins over a static tile", () => {
    expect(planRemoval([grow(200), stat(100), pack(50)]).mode).toBe("collapse");
  });

  it("rule 2: with a static tile and no grow tile, the leaving tile is held", () => {
    expect(planRemoval([stat(100), pack(50)])).toEqual({ mode: "hold", frozen: [100, 50] });
  });

  it("rule 3: all pack tiles keep their size and the leaving tile collapses", () => {
    expect(planRemoval([pack(100), pack(150)])).toEqual({ mode: "collapse", frozen: [100, 150] });
  });

  it("freezes only share sizes", () => {
    expect(planRemoval([sibling("static", 100, false), pack(50)]).frozen).toEqual([undefined, 50]);
  });

  it("rounds the frozen size to whole pixels", () => {
    expect(planRemoval([pack(100.6)]).frozen).toEqual([101]);
  });

  it("collapses when no tile stays", () => {
    expect(planRemoval([])).toEqual({ mode: "collapse", frozen: [] });
  });
});

describe("tileFlex", () => {
  it("defaults to grow, and a spacer is static", () => {
    expect(tileFlex(tile("a"))).toBe("grow");
    expect(tileFlex(tile("a", { flex: "pack" }))).toBe("pack");
    expect(tileFlex({ spacer: true, size: "10px" })).toBe("static");
  });
});

describe("describeDivider", () => {
  it("collapses the divider of a collapsing tile and the divider after a collapsing first tile", () => {
    const planned = (before: readonly Tile[], next: readonly Tile[]) => {
      const presence = applyPlan(stateOf(before, next), planRemoval(next.map(() => grow(100))), {});
      return listEntries(presence, next);
    };
    const middle = planned([tile("a"), tile("b"), tile("c")], [tile("a"), tile("c")]);
    expect(middle.map((_, i) => (i > 0 ? describeDivider(middle, i).isCollapsing : null))).toEqual([null, true, false]);

    const first = planned([tile("a"), tile("b")], [tile("b")]);
    expect(describeDivider(first, 1)).toMatchObject({ isCollapsing: true, resizableIndex: null });
  });

  it("numbers a resizable divider by the tiles that stay", () => {
    const entries = listEntries(stateOf([tile("a"), tile("b"), tile("c")], [tile("b"), tile("c")]), [
      tile("b"),
      tile("c"),
    ]);
    expect(describeDivider(entries, 2)).toMatchObject({ resizableIndex: 0 });
  });

  it("marks the divider of an entering tile", () => {
    const next = [tile("a"), tile("b")];
    const entries = listEntries(stateOf([tile("a")], next), next);
    expect(describeDivider(entries, 1)).toMatchObject({ isEntering: true, resizableIndex: 0 });
  });
});

describe("buildPatch", () => {
  it("is empty when nothing was frozen or held", () => {
    const next = [tile("a")];
    const presence = applyPlan(stateOf([tile("a"), tile("b")], next), planRemoval([grow(100)]), {});
    expect(buildPatch(presence, listEntries(presence, next))).toBeUndefined();
  });

  it("gives the frozen sizes of the tiles that stay", () => {
    const next = [tile("a")];
    const presence = applyPlan(stateOf([tile("b"), tile("a")], next), planRemoval([pack(100)]), {});
    expect(buildPatch(finishLeaving(presence, "id:b"), listEntries(presence, next))).toEqual({
      sizes: ["100px"],
      spacers: [],
    });
  });

  it("puts the spacer of a held tile at its place, after the animation", () => {
    const next = [tile("a"), tile("c")];
    const planned = applyPlan(stateOf([tile("a"), tile("b"), tile("c")], next), planRemoval([stat(100), stat(50)]), {
      "id:b": 80,
    });
    expect(buildPatch(planned, listEntries(planned, next))?.spacers).toEqual([]);

    const done = finishLeaving(planned, "id:b");
    expect(buildPatch(done, listEntries(done, next))).toEqual({
      sizes: ["100px", "50px"],
      spacers: [{ at: 1, tile: { id: "b", spacer: true, size: "80px" } }],
    });
  });
});

describe("finishLeaving", () => {
  it("removes a collapsed tile and keeps a held tile until its spacer arrives", () => {
    const presence = applyPlan(stateOf([tile("a"), tile("b")], [tile("a")]), planRemoval([stat(100)]), { "id:b": 80 });
    expect(finishLeaving(presence, "id:b").leaving).toMatchObject([{ key: "id:b", mode: "hold", isDone: true }]);

    const collapsed = applyPlan(stateOf([tile("a"), tile("b")], [tile("a")]), planRemoval([grow(100)]), {});
    expect(finishLeaving(collapsed, "id:b").leaving).toEqual([]);
  });
});
