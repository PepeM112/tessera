import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseLayout, type Layout } from "./layout";
import { lengthToPx, type LengthContext } from "./size";
import { Workspace } from "./workspace";

import type { ReactNode } from "react";

const noteRender = vi.fn();

interface NoteProps {
  label: string;
}

function Note({ label }: NoteProps) {
  noteRender();
  return <p>{label}</p>;
}

const MODULES = { note: Note };

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
});
