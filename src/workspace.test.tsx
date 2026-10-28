/// <reference types="@vitest/browser-playwright" />
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";

import { parseLayout, type Layout, type Tile, type TileFlex } from "./layout";
import { lengthToPx, type LengthContext } from "./size";
import { useTile } from "./use-tile";
import { Workspace } from "./workspace";

const noteRender = vi.fn();

interface NoteProps {
  label: string;
}

function Note({ label }: NoteProps) {
  noteRender();
  return <p>{label}</p>;
}

const mountSpy = vi.fn();

// Counts its own clicks and its mounts, so a test can tell a remount from a render.
function Counter({ label }: NoteProps) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    mountSpy(label);
  }, [label]);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {`${label}: ${count}`}
    </button>
  );
}

function TileProbe() {
  const { id, path } = useTile();
  return <p>{`tile ${id ?? "none"} at "${path}"`}</p>;
}

const MODULES = { note: Note, counter: Counter, probe: TileProbe };

const RESIZABLE: Layout = {
  root: {
    split: "row",
    resizable: true,
    children: [
      { module: "note", props: { label: "Left" } },
      { module: "note", props: { label: "Right" } },
    ],
  },
};

const FRAME_WIDTH = 800;

interface FrameProps {
  children?: ReactNode;
}

// The tests run in real Chromium. A fixed size makes the pixel values known: with the default padding (8px) and
// gap (8px), a split of two shares has two tiles of 388px (776px for the 2 shares). An arrow key moves the divider by
// 10px (10 * 2 / 776 = 0.026 share). A tile keeps at least 48px (48 * 2 / 776 = 0.124 share), so Home and End stop there.
function Frame({ children }: FrameProps) {
  return <div style={{ width: FRAME_WIDTH, height: 400 }}>{children}</div>;
}

function renderInFrame(ui: ReactNode) {
  return render(ui, { wrapper: Frame });
}

beforeEach(() => {
  noteRender.mockClear();
  mountSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

function tileOf(label: string): HTMLElement {
  const tile = screen.getByText(label).closest<HTMLElement>(".tessera-tile");
  if (!tile) throw new Error(`No tile for ${label}`);
  return tile;
}

function growOf(label: string): string {
  return tileOf(label).style.flexGrow;
}

describe("Workspace", () => {
  it("renders each module with the layout props as React props", () => {
    renderInFrame(<Workspace layout={RESIZABLE} modules={MODULES} />);
    expect(screen.getByText("Left")).toBeTruthy();
    expect(screen.getByText("Right")).toBeTruthy();
  });

  it("shows an unknown module id, with the default or a custom label", () => {
    const layout: Layout = { root: { module: "calendar" } };
    const { rerender } = renderInFrame(<Workspace layout={layout} modules={MODULES} />);
    expect(screen.getByText("Unknown module: calendar")).toBeTruthy();

    rerender(<Workspace layout={layout} modules={MODULES} labels={{ unknownModule: "Módulo desconocido" }} />);
    expect(screen.getByText("Módulo desconocido: calendar")).toBeTruthy();

    rerender(<Workspace layout={layout} modules={MODULES} renderUnknown={(id) => <em>Missing {id}</em>} />);
    expect(screen.getByText("Missing calendar")).toBeTruthy();
  });

  it("does not find methods of Object.prototype as modules", () => {
    renderInFrame(<Workspace layout={{ root: { module: "toString" } }} modules={MODULES} />);
    expect(screen.getByText("Unknown module: toString")).toBeTruthy();
  });

  it("sets the theme as CSS variables and a tile background inline", () => {
    const layout: Layout = { root: { module: "note", props: { label: "Only" }, background: "transparent" } };
    const { container } = renderInFrame(
      <Workspace layout={layout} modules={MODULES} theme={{ gap: 12, background: "black", radius: "4px" }} />,
    );
    const root = container.querySelector<HTMLElement>(".tessera-workspace");
    expect(root?.style.getPropertyValue("--tessera-gap")).toBe("12px");
    expect(root?.style.getPropertyValue("--tessera-background")).toBe("black");
    expect(root?.style.getPropertyValue("--tessera-radius")).toBe("4px");
    expect(screen.getByText("Only").closest<HTMLElement>(".tessera-tile")?.style.background).toBe("transparent");
  });

  it("gives a fixed split no separator", () => {
    const layout: Layout = { root: { ...RESIZABLE.root, resizable: false } };
    renderInFrame(<Workspace layout={layout} modules={MODULES} />);
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("gives a resizable split a labelled separator", () => {
    renderInFrame(<Workspace layout={RESIZABLE} modules={MODULES} labels={{ divider: "Cambiar tamaño" }} />);
    const separator = screen.getByRole("separator", { name: "Cambiar tamaño" });
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(separator.getAttribute("aria-valuenow")).toBe("50");
    expect(separator.tabIndex).toBe(0);
  });

  it("resizes with the arrow keys and Home, and sends each change", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    renderInFrame(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    const separator = screen.getByRole("separator");

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(growOf("Left")).toBe("1.026");
    expect(handleLayoutChange).toHaveBeenLastCalledWith({
      root: {
        ...RESIZABLE.root,
        children: [expect.objectContaining({ size: 1.026 }), expect.objectContaining({ size: 0.974 })],
      },
    });

    fireEvent.keyDown(separator, { key: "Home" });
    expect(growOf("Left")).toBe("0.124");
    fireEvent.keyDown(separator, { key: "ArrowUp" });
    expect(handleLayoutChange).toHaveBeenCalledTimes(2);
  });

  it("resets to the layout sizes on double-click", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    renderInFrame(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    const separator = screen.getByRole("separator");

    fireEvent.keyDown(separator, { key: "End" });
    expect(growOf("Left")).toBe("1.876");
    fireEvent.doubleClick(separator);
    expect(growOf("Left")).toBe("1");
    expect(handleLayoutChange).toHaveBeenLastCalledWith(RESIZABLE);
  });

  it("drags without a module render and sends the layout once at the end", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    renderInFrame(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    const rendersBefore = noteRender.mock.calls.length;
    const separator = screen.getByRole("separator");

    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 120 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 150 });
    expect(growOf("Left")).toBe("1.129");
    expect(handleLayoutChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(document, { pointerId: 1, clientX: 150 });
    expect(handleLayoutChange).toHaveBeenCalledTimes(1);
    expect(noteRender).toHaveBeenCalledTimes(rendersBefore);
  });

  it("sends a layout that parses and renders the same sizes", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    renderInFrame(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    const separator = screen.getByRole("separator");
    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 150 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 150 });

    const result = parseLayout(JSON.parse(JSON.stringify(handleLayoutChange.mock.lastCall?.[0])));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    cleanup();
    renderInFrame(<Workspace layout={result.layout} modules={MODULES} />);
    expect(growOf("Left")).toBe("1.129");
  });

  it("resets the sizes when the layout prop changes", () => {
    const { rerender } = renderInFrame(<Workspace layout={RESIZABLE} modules={MODULES} />);
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });
    expect(growOf("Left")).toBe("1.026");

    rerender(<Workspace layout={{ ...RESIZABLE }} modules={MODULES} />);
    expect(growOf("Left")).toBe("1");
  });

  it("ignores a layout that the app feeds back from onLayoutChange, and still resets to the original sizes", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const { rerender } = renderInFrame(
      <Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />,
    );
    const separator = screen.getByRole("separator");
    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 150 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 150 });
    const sent = handleLayoutChange.mock.lastCall?.[0];
    if (!sent) throw new Error("No layout sent");
    expect(growOf("Left")).toBe("1.129");
    expect(handleLayoutChange).toHaveBeenCalledTimes(1);
    expect(parseLayout(JSON.parse(JSON.stringify(sent))).ok).toBe(true);

    rerender(<Workspace layout={sent} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    expect(growOf("Left")).toBe("1.129");
    expect(handleLayoutChange).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".tessera-workspace")?.hasAttribute("data-instant")).toBe(true);

    fireEvent.doubleClick(separator);
    expect(growOf("Left")).toBe("1");
    expect(handleLayoutChange).toHaveBeenLastCalledWith(RESIZABLE);
  });

  it("shows a sent layout again when the app brings it back after another layout", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const { rerender } = renderInFrame(
      <Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />,
    );
    fireEvent.keyDown(screen.getByRole("separator"), { key: "End" });
    const sent = handleLayoutChange.mock.lastCall?.[0];
    if (!sent) throw new Error("No layout sent");
    rerender(<Workspace layout={sent} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    rerender(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    expect(growOf("Left")).toBe("1");

    rerender(<Workspace layout={sent} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    expect(growOf("Left")).not.toBe("1");
  });

  it("resets a deep-equal copy of the last sent layout, like any new layout", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const { rerender } = renderInFrame(
      <Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />,
    );
    const separator = screen.getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    const sent = handleLayoutChange.mock.lastCall?.[0];
    if (!sent) throw new Error("No layout sent");
    expect(document.querySelector(".tessera-workspace")?.hasAttribute("data-instant")).toBe(true);

    rerender(<Workspace layout={structuredClone(sent)} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    expect(document.querySelector(".tessera-workspace")?.hasAttribute("data-instant")).toBe(false);

    fireEvent.keyDown(separator, { key: "End" });
    expect(growOf("Left")).toBe("1.876");
    fireEvent.doubleClick(separator);
    expect(growOf("Left")).toBe("1.026");
  });

  it("sizes tiles like CSS flexbox with gap, in real pixels", () => {
    const layout: Layout = {
      root: {
        split: "row",
        children: [
          { module: "note", props: { label: "20%" }, size: "20%" },
          { module: "note", props: { label: "12rem" }, size: "12rem" },
          { module: "note", props: { label: "Share 1" }, size: 1 },
          { module: "note", props: { label: "Share 2" }, size: 2 },
          { module: "note", props: { label: "200px" }, size: "200px" },
        ],
      },
    };
    const gap = 12;
    renderInFrame(<Workspace layout={layout} modules={MODULES} theme={{ gap, padding: 0 }} />);

    const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const context: LengthContext = {
      containerPx: FRAME_WIDTH,
      rootFontPx,
      fontPx: rootFontPx,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
    const [percent, rem, px] = [lengthToPx("20%", context), lengthToPx("12rem", context), lengthToPx("200px", context)];
    const freePx = FRAME_WIDTH - 4 * gap - percent - rem - px;
    const expected: Record<string, number> = {
      "20%": percent,
      "12rem": rem,
      "Share 1": freePx / 3,
      "Share 2": (freePx * 2) / 3,
      "200px": px,
    };

    Object.entries(expected).forEach(([label, width]) => {
      // Chromium lays out in 1/64px units, so a width can be up to 0.008px off the exact value.
      expect(Math.abs(tileOf(label).getBoundingClientRect().width - width), `${label} tile width`).toBeLessThan(0.01);
    });
  });

  it("does not scroll the tile when a focused element is below the fold", () => {
    const layout: Layout = { root: { module: "tall", props: {} } };
    const Tall = () => (
      <div style={{ height: 2000 }}>
        <button type="button" style={{ marginTop: 1500 }}>
          Bottom
        </button>
      </div>
    );
    renderInFrame(<Workspace layout={layout} modules={{ tall: Tall }} />);

    screen.getByRole("button", { name: "Bottom" }).focus();

    expect(document.querySelector<HTMLElement>(".tessera-module")?.scrollTop).toBe(0);
  });

  it("draws the tile border from the tileBorder theme value", () => {
    const layout: Layout = { root: { module: "note", props: { label: "Solo" } } };
    const borderWidthOf = (): string => getComputedStyle(tileOf("Solo"), "::after").borderTopWidth;

    const { rerender } = renderInFrame(<Workspace layout={layout} modules={MODULES} />);
    expect(borderWidthOf()).toBe("1px");

    rerender(<Workspace layout={layout} modules={MODULES} theme={{ tileBorder: "3px solid red" }} />);
    expect(borderWidthOf()).toBe("3px");
  });
  it("keeps the module state of a tile with an id when an earlier sibling is removed", async () => {
    const both: Layout = {
      root: {
        split: "row",
        children: [
          { id: "a", module: "counter", props: { label: "A" } },
          { id: "b", module: "counter", props: { label: "B" } },
        ],
      },
    };
    const onlyB: Layout = { root: { ...both.root, children: [{ id: "b", module: "counter", props: { label: "B" } }] } };
    const { rerender } = renderInFrame(<Workspace layout={both} modules={MODULES} />);
    fireEvent.click(screen.getByRole("button", { name: "B: 0" }));

    rerender(<Workspace layout={onlyB} modules={MODULES} />);

    expect(screen.getByRole("button", { name: "B: 1" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: /^A/ })).toBeNull());
    expect(mountSpy.mock.calls).toEqual([["A"], ["B"]]);
  });

  it("keeps the state of a tile with an id when the siblings change order", () => {
    const tile = (id: string) => ({ id, module: "counter", props: { label: id } });
    const first: Layout = { root: { split: "row", children: [tile("A"), tile("B")] } };
    const second: Layout = { root: { split: "row", children: [tile("B"), tile("A")] } };
    const { rerender } = renderInFrame(<Workspace layout={first} modules={MODULES} />);
    fireEvent.click(screen.getByRole("button", { name: "A: 0" }));

    rerender(<Workspace layout={second} modules={MODULES} />);

    expect(screen.getByRole("button", { name: "A: 1" })).toBeTruthy();
    expect(mountSpy).toHaveBeenCalledTimes(2);
  });

  it("renders a spacer as an invisible tile that holds its size", () => {
    const layout: Layout = {
      root: {
        split: "row",
        children: [
          { module: "note", props: { label: "Left" }, size: "100px" },
          { spacer: true, id: "gap", size: "120px" },
          { module: "note", props: { label: "Right" } },
        ],
      },
    };
    const { container } = renderInFrame(<Workspace layout={layout} modules={MODULES} />);
    const spacer = container.querySelector<HTMLElement>(".tessera-spacer");

    expect(spacer?.getAttribute("aria-hidden")).toBe("true");
    expect(spacer?.dataset.tileId).toBe("gap");
    expect(Math.abs((spacer?.getBoundingClientRect().width ?? 0) - 120)).toBeLessThan(0.01);
    expect(spacer?.childElementCount).toBe(0);
    expect(spacer && getComputedStyle(spacer).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(spacer && getComputedStyle(spacer, "::after").content).toBe("none");
    expect(tileOf("Right").getBoundingClientRect().left).toBeGreaterThan(spacer?.getBoundingClientRect().right ?? 0);
  });

  it("renders the appearance of a tile, and the theme where a tile sets nothing", () => {
    const layout: Layout = {
      root: {
        split: "row",
        children: [
          {
            module: "note",
            props: { label: "Styled" },
            radius: 12,
            borderWidth: "3px",
            borderColor: "rgb(255, 0, 0)",
            elevation: 2,
          },
          { module: "note", props: { label: "Plain" } },
        ],
      },
    };
    renderInFrame(<Workspace layout={layout} modules={MODULES} theme={{ radius: 4, elevation2: "0 0 0 5px blue" }} />);
    const styled = tileOf("Styled");
    const plain = tileOf("Plain");

    expect(styled.dataset.elevation).toBe("2");
    expect(styled.style.getPropertyValue("--tessera-tile-radius")).toBe("12px");
    expect(getComputedStyle(styled).borderTopLeftRadius).toBe("12px");
    expect(getComputedStyle(styled).boxShadow).toContain("5px");
    expect(getComputedStyle(styled, "::after").borderTopWidth).toBe("3px");
    expect(getComputedStyle(styled, "::after").borderTopColor).toBe("rgb(255, 0, 0)");

    expect(plain.dataset.elevation).toBeUndefined();
    expect(getComputedStyle(plain).borderTopLeftRadius).toBe("4px");
    expect(getComputedStyle(plain).boxShadow).toBe("none");
    expect(getComputedStyle(plain, "::after").borderTopWidth).toBe("1px");
  });

  it("gives elevation 0 no shadow, even when the theme sets a tile shadow", () => {
    const layout: Layout = { root: { module: "note", props: { label: "Flat" }, elevation: 0 } };
    renderInFrame(<Workspace layout={layout} modules={MODULES} theme={{ tileShadow: "0 0 0 5px blue" }} />);
    expect(getComputedStyle(tileOf("Flat")).boxShadow).toBe("none");
  });

  describe("windows", () => {
    const WINDOWS: Layout = {
      root: {
        windows: [
          { module: "counter", props: { label: "One" } },
          { module: "counter", props: { label: "Two" } },
          { module: "note", props: { label: "Three" } },
        ],
      },
    };

    function dots(): HTMLElement[] {
      return screen.getAllByRole("button", { name: /^Window \d of 3$/ });
    }

    it("mounts every window and shows one dot per window", () => {
      renderInFrame(<Workspace layout={WINDOWS} modules={MODULES} />);

      expect(mountSpy.mock.calls).toEqual([["One"], ["Two"]]);
      expect(screen.getByText("Three")).toBeTruthy();
      expect(dots().map((dot) => dot.getAttribute("aria-current"))).toEqual(["true", null, null]);
      expect(document.querySelector<HTMLElement>(".tessera-windows")?.children).toHaveLength(3);
    });

    it("scrolls to a window and marks its dot when a dot is clicked", async () => {
      renderInFrame(<Workspace layout={WINDOWS} modules={MODULES} />);
      const scroller = document.querySelector<HTMLElement>(".tessera-windows");

      fireEvent.click(dots()[2]);

      await waitFor(() => expect(dots()[2].getAttribute("aria-current")).toBe("true"));
      expect(dots()[0].getAttribute("aria-current")).toBeNull();
      await waitFor(() =>
        expect(Math.abs((scroller?.scrollLeft ?? 0) - 2 * (scroller?.clientWidth ?? 0))).toBeLessThan(1),
      );
    });

    it("moves between windows and focus with the arrow keys", async () => {
      renderInFrame(<Workspace layout={WINDOWS} modules={MODULES} />);

      dots()[0].focus();
      fireEvent.keyDown(dots()[0], { key: "ArrowRight" });
      expect(document.activeElement).toBe(dots()[1]);
      await waitFor(() => expect(dots()[1].getAttribute("aria-current")).toBe("true"));

      fireEvent.keyDown(dots()[1], { key: "ArrowLeft" });
      expect(document.activeElement).toBe(dots()[0]);
      await waitFor(() => expect(dots()[0].getAttribute("aria-current")).toBe("true"));

      fireEvent.keyDown(dots()[0], { key: "ArrowLeft" });
      expect(document.activeElement).toBe(dots()[0]);
    });

    it("shows the dots on focus only, with a configurable label", async () => {
      const labels = { window: (position: number, total: number) => `Ventana ${position} de ${total}` };
      renderInFrame(<Workspace layout={WINDOWS} modules={MODULES} labels={labels} />);
      const dotsElement = document.querySelector<HTMLElement>(".tessera-window-dots");

      expect(screen.getByRole("button", { name: "Ventana 2 de 3" })).toBeTruthy();
      expect(dotsElement && getComputedStyle(dotsElement).opacity).toBe("0");
      screen.getByRole("button", { name: "Ventana 1 de 3" }).focus();
      await waitFor(() => expect(dotsElement && getComputedStyle(dotsElement).opacity).toBe("1"));
    });

    it("shows no dots for a single window", () => {
      const layout: Layout = { root: { windows: [{ module: "note", props: { label: "Only" } }] } };
      renderInFrame(<Workspace layout={layout} modules={MODULES} />);
      expect(screen.getByText("Only")).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  it("gives a module its tile id and path with useTile", () => {
    const layout: Layout = {
      root: {
        split: "row",
        children: [
          { module: "note", props: { label: "x" } },
          { id: "probe", module: "probe" },
        ],
      },
    };
    renderInFrame(<Workspace layout={layout} modules={MODULES} />);
    expect(screen.getByText('tile probe at "1"')).toBeTruthy();
  });

  it("throws a clear error when useTile runs outside a tile", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<TileProbe />)).toThrow(/useTile works only inside/);
    spy.mockRestore();
  });
});

describe("Workspace animation", () => {
  const FAST = { transitionDuration: "150ms" };

  function counter(id: string, flex?: TileFlex): Tile {
    return { id, module: "counter", props: { label: id }, ...(flex ? { flex } : {}) };
  }

  function row(...children: Tile[]): Layout {
    return { root: { split: "row", children } };
  }

  function byId(id: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(`.tessera-tile[data-tile-id="${id}"]`);
    if (!element) throw new Error(`No tile ${id}`);
    return element;
  }

  const widthOf = (id: string): number => byId(id).getBoundingClientRect().width;
  const leftOf = (id: string): number => byId(id).getBoundingClientRect().left;
  const isGone = (id: string): boolean => document.querySelector(`.tessera-tile[data-tile-id="${id}"]`) === null;
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  function parsed(layout: Layout | undefined): Layout {
    const result = parseLayout(JSON.parse(JSON.stringify(layout)));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.layout;
  }

  it("C1: removing a grow tile grows its sibling to the full width and keeps its module", async () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const { rerender } = renderInFrame(
      <Workspace
        layout={row(counter("A"), counter("B"))}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "A: 0" }));
    expect(widthOf("A")).toBeCloseTo(388, 0);

    rerender(
      <Workspace layout={row(counter("A"))} modules={MODULES} theme={FAST} onLayoutChange={handleLayoutChange} />,
    );
    expect(byId("B").dataset.leaving).toBe("collapse");
    expect(widthOf("A")).toBeLessThan(500);

    await waitFor(() => expect(isGone("B")).toBe(true));
    expect(widthOf("A")).toBeCloseTo(784, 0);
    expect(screen.getByRole("button", { name: "A: 1" })).toBeTruthy();
    expect(mountSpy.mock.calls).toEqual([["A"], ["B"]]);
    await wait(50);
    expect(handleLayoutChange).not.toHaveBeenCalled();
  });

  it("C2: a pack tile keeps its pixel width, slides to the start, and the frozen size is sent once", async () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const { rerender } = renderInFrame(
      <Workspace
        layout={row(counter("B"), counter("A", "pack"))}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );
    expect(leftOf("A")).toBeCloseTo(404, 0);

    const next = row(counter("A", "pack"));
    rerender(<Workspace layout={next} modules={MODULES} theme={FAST} onLayoutChange={handleLayoutChange} />);
    expect(widthOf("A")).toBeCloseTo(388, 0);

    await waitFor(() => expect(handleLayoutChange).toHaveBeenCalledTimes(1));
    expect(isGone("B")).toBe(true);
    expect(widthOf("A")).toBeCloseTo(388, 0);
    expect(leftOf("A")).toBeCloseTo(8, 0);

    const written = handleLayoutChange.mock.lastCall?.[0];
    expect(written).toEqual(row({ ...counter("A", "pack"), size: "388px" }));

    // The parent feeds the layout back: nothing animates, nothing mounts again, nothing is sent again.
    rerender(<Workspace layout={parsed(written)} modules={MODULES} theme={FAST} onLayoutChange={handleLayoutChange} />);
    expect(byId("A").dataset.frozen).toBeUndefined();
    expect(leftOf("A")).toBeCloseTo(8, 0);
    await wait(250);
    expect(handleLayoutChange).toHaveBeenCalledTimes(1);
    expect(mountSpy.mock.calls).toEqual([["B"], ["A"]]);

    cleanup();
    renderInFrame(<Workspace layout={parsed(written)} modules={MODULES} />);
    expect(widthOf("A")).toBeCloseTo(388, 0);
    expect(leftOf("A")).toBeCloseTo(8, 0);
  });

  it("C3: a static tile keeps its size and place, and a spacer takes the place of the removed tile", async () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const { rerender } = renderInFrame(
      <Workspace
        layout={row(counter("A", "static"), counter("B"))}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );

    rerender(
      <Workspace
        layout={row(counter("A", "static"))}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );
    expect(byId("B").dataset.leaving).toBe("hold");

    await waitFor(() => expect(handleLayoutChange).toHaveBeenCalledTimes(1));
    const written = handleLayoutChange.mock.lastCall?.[0];
    expect(written).toEqual(
      row({ ...counter("A", "static"), size: "388px" }, { id: "B", spacer: true, size: "388px" }),
    );
    expect(widthOf("A")).toBeCloseTo(388, 0);
    expect(leftOf("A")).toBeCloseTo(8, 0);
    expect(widthOf("B")).toBeCloseTo(388, 0);
    expect(byId("B").classList.contains("tessera-spacer")).toBe(true);

    cleanup();
    renderInFrame(<Workspace layout={parsed(written)} modules={MODULES} />);
    expect(widthOf("A")).toBeCloseTo(388, 0);
    expect(leftOf("B")).toBeCloseTo(404, 0);
    expect(widthOf("B")).toBeCloseTo(388, 0);
  });

  it("C3b: a grow sibling takes the space, so no spacer is added", async () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const three = row(counter("A", "static"), counter("C"), counter("B"));
    const { rerender } = renderInFrame(
      <Workspace layout={three} modules={MODULES} theme={FAST} onLayoutChange={handleLayoutChange} />,
    );
    const aWidth = widthOf("A");

    rerender(
      <Workspace
        layout={row(counter("A", "static"), counter("C"))}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );
    expect(byId("B").dataset.leaving).toBe("collapse");

    await waitFor(() => expect(handleLayoutChange).toHaveBeenCalledTimes(1));
    expect(handleLayoutChange.mock.lastCall?.[0]).toEqual(
      row({ ...counter("A", "static"), size: `${Math.round(aWidth)}px` }, counter("C")),
    );
    expect(widthOf("A")).toBeCloseTo(Math.round(aWidth), 0);
    expect(widthOf("C")).toBeCloseTo(784 - 8 - Math.round(aWidth), 0);
  });

  it("resets a divider to the sizes of the patched children after a removal was fed back", async () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const resizableRow = (...children: Tile[]): Layout => ({ root: { split: "row", resizable: true, children } });
    const { rerender } = renderInFrame(
      <Workspace
        layout={resizableRow(counter("A", "static"), counter("B", "static"))}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );
    rerender(
      <Workspace
        layout={resizableRow(counter("A", "static"))}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );
    await waitFor(() => expect(handleLayoutChange).toHaveBeenCalledTimes(1));
    const written = handleLayoutChange.mock.lastCall?.[0];
    if (!written) throw new Error("No layout sent");
    expect(written).toEqual(
      resizableRow({ ...counter("A", "static"), size: "388px" }, { id: "B", spacer: true, size: "388px" }),
    );

    rerender(<Workspace layout={written} modules={MODULES} theme={FAST} onLayoutChange={handleLayoutChange} />);
    expect(isGone("B")).toBe(false);
    expect(byId("B").classList.contains("tessera-spacer")).toBe(true);

    const separator = screen.getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(widthOf("A")).toBeGreaterThan(388);
    fireEvent.doubleClick(separator);
    expect(widthOf("A")).toBeCloseTo(388, 0);
    expect(widthOf("B")).toBeCloseTo(388, 0);
    expect(handleLayoutChange.mock.lastCall?.[0]).toEqual(written);
  });

  it("sends one layout when two splits finish together", async () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const group = (id: string, ...children: Tile[]): Tile => ({ id, split: "row", children });
    const both = (a: Tile[], c: Tile[]): Layout => ({
      root: { split: "column", children: [group("g1", ...a), group("g2", ...c)] },
    });
    const { rerender } = renderInFrame(
      <Workspace
        layout={both([counter("A", "pack"), counter("B")], [counter("C", "pack"), counter("D")])}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );

    rerender(
      <Workspace
        layout={both([counter("A", "pack")], [counter("C", "pack")])}
        modules={MODULES}
        theme={FAST}
        onLayoutChange={handleLayoutChange}
      />,
    );

    await waitFor(() => expect(handleLayoutChange).toHaveBeenCalled());
    await wait(100);
    expect(handleLayoutChange).toHaveBeenCalledTimes(1);
    const written = JSON.stringify(handleLayoutChange.mock.lastCall?.[0]);
    expect(written).toContain('"flex":"pack","size":"388px"}]},{"id":"g2"');
    expect(written).toContain('"flex":"pack","size":"388px"}]}]}');
  });

  it("works in StrictMode and does not render the module again during the animation", async () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    const note = (id: string, flex?: TileFlex): Tile => ({
      id,
      module: "note",
      props: { label: id },
      ...(flex ? { flex } : {}),
    });
    const ui = (layout: Layout) => (
      <StrictMode>
        <Workspace layout={layout} modules={MODULES} theme={FAST} onLayoutChange={handleLayoutChange} />
      </StrictMode>
    );
    const { rerender } = renderInFrame(ui(row(note("B"), note("A", "pack"))));
    const rendersBefore = noteRender.mock.calls.length;

    rerender(ui(row(note("A", "pack"))));
    await waitFor(() => expect(handleLayoutChange).toHaveBeenCalledTimes(1));
    await wait(50);

    expect(handleLayoutChange).toHaveBeenCalledTimes(1);
    expect(isGone("B")).toBe(true);
    expect(leftOf("A")).toBeCloseTo(8, 0);
    expect(noteRender.mock.calls.length - rendersBefore).toBeLessThanOrEqual(2);
  });

  it("C4: a restored tile grows from 0, and a size change from a new layout animates", async () => {
    const { rerender } = renderInFrame(<Workspace layout={row(counter("A"))} modules={MODULES} theme={FAST} />);

    rerender(<Workspace layout={row(counter("A"), counter("B"))} modules={MODULES} theme={FAST} />);
    expect(widthOf("B")).toBeLessThan(60);
    await waitFor(() => expect(widthOf("B")).toBeCloseTo(388, 0));

    rerender(<Workspace layout={row({ ...counter("A"), size: 3 }, counter("B"))} modules={MODULES} theme={FAST} />);
    expect(widthOf("A")).toBeLessThan(450);
    await waitFor(() => expect(widthOf("A")).toBeCloseTo(582, 0));
  });

  it("C4: a divider resize has no transition", () => {
    renderInFrame(<Workspace layout={RESIZABLE} modules={MODULES} theme={{ transitionDuration: "2s" }} />);
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });
    expect(tileOf("Left").getBoundingClientRect().width).toBeCloseTo(398.09, 1);

    const separator = screen.getByRole("separator");
    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 150 });
    expect(tileOf("Left").getBoundingClientRect().width).toBeCloseTo(398.09 + 50, 0);
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 150 });
  });

  it("C4: with reduced motion a removal is instant", async () => {
    await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    try {
      const { rerender } = renderInFrame(
        <Workspace layout={row(counter("A"), counter("B"))} modules={MODULES} theme={{ transitionDuration: "2s" }} />,
      );
      rerender(<Workspace layout={row(counter("A"))} modules={MODULES} theme={{ transitionDuration: "2s" }} />);
      expect(widthOf("A")).toBeCloseTo(784, 0);
      await waitFor(() => expect(isGone("B")).toBe(true), { timeout: 500 });
    } finally {
      await cdp().send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
      });
    }
  });
});
