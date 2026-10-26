import { describe, expect, it } from "vitest";

import { isCssLength, lengthToPx, resizePair, tileFlexStyle, type LengthContext, type ResizeInput } from "./size";

const CONTEXT: LengthContext = {
  containerPx: 1000,
  rootFontPx: 16,
  fontPx: 20,
  viewportWidth: 1200,
  viewportHeight: 800,
};

function input(overrides: Partial<ResizeInput>): ResizeInput {
  return {
    sizes: [1, 1],
    pixels: [400, 400],
    minPixels: [48, 48],
    index: 0,
    delta: 0,
    context: CONTEXT,
    ...overrides,
  };
}

describe("isCssLength", () => {
  it("accepts the supported units", () => {
    expect(["240px", "30%", "1.5rem", "2em", "50vw", ".5vh", "0px"].every(isCssLength)).toBe(true);
  });

  it("refuses other values", () => {
    expect(["240", "-5px", "10pt", "px", "1e3px", " 10px", 10].some(isCssLength)).toBe(false);
  });
});

describe("lengthToPx", () => {
  it("converts each unit", () => {
    expect(lengthToPx("240px", CONTEXT)).toBe(240);
    expect(lengthToPx("25%", CONTEXT)).toBe(250);
    expect(lengthToPx("2rem", CONTEXT)).toBe(32);
    expect(lengthToPx("2em", CONTEXT)).toBe(40);
    expect(lengthToPx("10vw", CONTEXT)).toBe(120);
    expect(lengthToPx("10vh", CONTEXT)).toBe(80);
  });
});

describe("tileFlexStyle", () => {
  it("gives a share a basis of 0", () => {
    expect(tileFlexStyle(3, undefined, "row")).toEqual({ flex: "3 1 0" });
    expect(tileFlexStyle(undefined, undefined, "row")).toEqual({ flex: "1 1 0" });
  });

  it("uses a length as the basis", () => {
    expect(tileFlexStyle("240px", undefined, "row")).toEqual({ flex: "0 1 240px" });
  });

  it("sets the minimum on the main axis", () => {
    expect(tileFlexStyle(1, "48px", "row")).toEqual({ flex: "1 1 0", minWidth: "48px" });
    expect(tileFlexStyle(1, "3rem", "column")).toEqual({ flex: "1 1 0", minHeight: "3rem" });
  });
});

describe("resizePair", () => {
  it("moves the space between two shares and keeps their sum", () => {
    expect(resizePair(input({ delta: 100 }))).toEqual([1.25, 0.75]);
  });

  it("keeps px as px and leaves the only share as it is", () => {
    const sizes = resizePair(input({ sizes: ["240px", 1], pixels: [240, 760], delta: 60 }));
    expect(sizes).toEqual(["300px", 1]);
  });

  it("keeps % as %", () => {
    expect(resizePair(input({ sizes: ["30%", 1], pixels: [300, 700], delta: -50 }))).toEqual(["25%", 1]);
  });

  it("turns other units into px", () => {
    expect(resizePair(input({ sizes: ["10rem", 1], pixels: [160, 840], delta: 40 }))).toEqual(["200px", 1]);
  });

  it("gives a share next to a length the value that keeps the other shares the same size", () => {
    // [200px, share 1 (400px), share 1 (400px)]: the divider between child 0 and child 1 moves by +100.
    const sizes = resizePair(
      input({ sizes: ["200px", 1, 1], pixels: [200, 400, 400], minPixels: [48, 48, 48], delta: 100 }),
    );
    expect(sizes).toEqual(["300px", 0.75, 1]);
  });

  it("changes only the two children next to the divider", () => {
    const sizes = resizePair(
      input({ sizes: [1, 2, 1], pixels: [250, 500, 250], minPixels: [48, 48, 48], index: 1, delta: 100 }),
    );
    expect(sizes).toEqual([1, 2.4, 0.6]);
  });

  it("stops at the minimum sizes", () => {
    expect(resizePair(input({ delta: -1000 }))).toEqual([0.12, 1.88]);
    expect(resizePair(input({ delta: Infinity, minPixels: [48, 100] }))).toEqual([1.75, 0.25]);
  });

  it("gives a missing size the default share 1", () => {
    expect(resizePair(input({ sizes: [undefined, undefined], delta: 0 }))).toEqual([1, 1]);
  });

  it("does not move when the minimum sizes do not fit", () => {
    expect(resizePair(input({ pixels: [40, 40], delta: 10 }))).toEqual([1, 1]);
  });
});
