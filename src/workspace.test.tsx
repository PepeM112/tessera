import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseLayout, type Layout } from "./layout";
import { Workspace } from "./workspace";

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

// jsdom has no layout engine: each tile measures 100px and each split 208px (two tiles and an 8px gap).
beforeEach(() => {
  noteRender.mockClear();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ width: 100, height: 100 }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(208);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function growOf(label: string): string | undefined {
  return screen.getByText(label).closest<HTMLElement>(".tessera-tile")?.style.flexGrow;
}

describe("Workspace", () => {
  it("renders each module with the layout props as React props", () => {
    render(<Workspace layout={RESIZABLE} modules={MODULES} />);
    expect(screen.getByText("Left")).toBeTruthy();
    expect(screen.getByText("Right")).toBeTruthy();
  });

  it("shows an unknown module id, with the default or a custom label", () => {
    const layout: Layout = { root: { module: "calendar" } };
    const { rerender } = render(<Workspace layout={layout} modules={MODULES} />);
    expect(screen.getByText("Unknown module: calendar")).toBeTruthy();

    rerender(<Workspace layout={layout} modules={MODULES} labels={{ unknownModule: "Módulo desconocido" }} />);
    expect(screen.getByText("Módulo desconocido: calendar")).toBeTruthy();

    rerender(<Workspace layout={layout} modules={MODULES} renderUnknown={(id) => <em>Missing {id}</em>} />);
    expect(screen.getByText("Missing calendar")).toBeTruthy();
  });

  it("does not find methods of Object.prototype as modules", () => {
    render(<Workspace layout={{ root: { module: "toString" } }} modules={MODULES} />);
    expect(screen.getByText("Unknown module: toString")).toBeTruthy();
  });

  it("sets the theme as CSS variables and a tile background inline", () => {
    const layout: Layout = { root: { module: "note", props: { label: "Only" }, background: "transparent" } };
    const { container } = render(
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
    render(<Workspace layout={layout} modules={MODULES} />);
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("gives a resizable split a labelled separator", () => {
    render(<Workspace layout={RESIZABLE} modules={MODULES} labels={{ divider: "Cambiar tamaño" }} />);
    const separator = screen.getByRole("separator", { name: "Cambiar tamaño" });
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(separator.getAttribute("aria-valuenow")).toBe("50");
    expect(separator.tabIndex).toBe(0);
  });

  it("resizes with the arrow keys and Home, and sends each change", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    render(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    const separator = screen.getByRole("separator");

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(growOf("Left")).toBe("1.1");
    expect(handleLayoutChange).toHaveBeenLastCalledWith({
      root: {
        ...RESIZABLE.root,
        children: [expect.objectContaining({ size: 1.1 }), expect.objectContaining({ size: 0.9 })],
      },
    });

    fireEvent.keyDown(separator, { key: "Home" });
    expect(growOf("Left")).toBe("0.48");
    fireEvent.keyDown(separator, { key: "ArrowUp" });
    expect(handleLayoutChange).toHaveBeenCalledTimes(2);
  });

  it("resets to the layout sizes on double-click", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    render(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    const separator = screen.getByRole("separator");

    fireEvent.keyDown(separator, { key: "End" });
    fireEvent.doubleClick(separator);
    expect(growOf("Left")).toBe("1");
    expect(handleLayoutChange).toHaveBeenLastCalledWith(RESIZABLE);
  });

  it("drags without a module render and sends the layout once at the end", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    render(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    const rendersBefore = noteRender.mock.calls.length;
    const separator = screen.getByRole("separator");

    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 120 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 150 });
    expect(growOf("Left")).toBe("1.5");
    expect(handleLayoutChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(document, { pointerId: 1, clientX: 150 });
    expect(handleLayoutChange).toHaveBeenCalledTimes(1);
    expect(noteRender).toHaveBeenCalledTimes(rendersBefore);
  });

  it("sends a layout that parses and renders the same sizes", () => {
    const handleLayoutChange = vi.fn<(layout: Layout) => void>();
    render(<Workspace layout={RESIZABLE} modules={MODULES} onLayoutChange={handleLayoutChange} />);
    const separator = screen.getByRole("separator");
    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 150 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 150 });

    const result = parseLayout(JSON.parse(JSON.stringify(handleLayoutChange.mock.lastCall?.[0])));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    cleanup();
    render(<Workspace layout={result.layout} modules={MODULES} />);
    expect(growOf("Left")).toBe("1.5");
  });

  it("resets the sizes when the layout prop changes", () => {
    const { rerender } = render(<Workspace layout={RESIZABLE} modules={MODULES} />);
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });
    expect(growOf("Left")).toBe("1.1");

    rerender(<Workspace layout={{ ...RESIZABLE }} modules={MODULES} />);
    expect(growOf("Left")).toBe("1");
  });
});
