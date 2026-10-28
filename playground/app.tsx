import { useCallback, useMemo, useState, type ChangeEvent } from "react";

import { parseLayout, Workspace, type Layout, type TileFlex, type WorkspaceTheme } from "tessera";

import { CardControls } from "./card-controls";
import { EXAMPLES, type Example } from "./layouts";
import { MODULES } from "./modules";
import { TileActionsContext } from "./tile-actions";
import { listCards, removeTile, restoreTile, withFlex, type RemovedTile } from "./tile-tree";

type ColorScheme = "dark" | "light";

interface ThemeState {
  gap: number;
  radius: number;
  padding: number;
  background: string;
  tileBackground: string;
  dividerColor: string;
}

const SCHEME_COLORS = {
  dark: { background: "#111318", tileBackground: "#1c1f26", dividerColor: "#111318" },
  light: { background: "#e9ebef", tileBackground: "#ffffff", dividerColor: "#e9ebef" },
} as const satisfies Record<ColorScheme, Pick<ThemeState, "background" | "tileBackground" | "dividerColor">>;

const INITIAL_THEME: ThemeState = { gap: 8, radius: 8, padding: 8, ...SCHEME_COLORS.dark };

const [FIRST_EXAMPLE] = EXAMPLES;

const JSON_ERRORS_ID = "layout-json-errors";

type JsonLayoutResult = { layout: Layout } | { errors: string[] };

interface LayoutState {
  layout: Layout | undefined;
  removed: RemovedTile[];
}

// Text that the user typed in the editor. It shows only while it belongs to the current layout.
interface EditedText {
  text: string;
  layout: Layout | undefined;
}

export function App() {
  const [example, setExample] = useState<Example | undefined>(FIRST_EXAMPLE);
  const [{ layout, removed }, setState] = useState<LayoutState>({ layout: FIRST_EXAMPLE?.layout, removed: [] });
  const [edited, setEdited] = useState<EditedText | undefined>();
  const text = edited && edited.layout === layout ? edited.text : formatLayout(layout);
  const errors = useMemo(() => errorsOf(text), [text]);
  const cards = useMemo(() => (example ? listCards(example.layout.root) : []), [example]);
  const [scheme, setScheme] = useState<ColorScheme>("dark");
  const [theme, setTheme] = useState<ThemeState>(INITIAL_THEME);

  const handleSelect = (next: Example): void => {
    setExample(next);
    // A new object, so the Workspace resets the sizes: it resets only when the layout reference changes.
    setState({ layout: { ...next.layout }, removed: [] });
    setEdited(undefined);
  };

  const handleJsonChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    const next = event.target.value;
    const result = parseJsonLayout(next);
    // Bad text keeps the last valid layout on screen.
    if ("layout" in result) {
      setEdited({ text: next, layout: result.layout });
      setState((current) => ({ ...current, layout: result.layout }));
      return;
    }
    setEdited({ text: next, layout });
  };

  const handleLayoutChange = (next: Layout): void => {
    setState((current) => ({ ...current, layout: next }));
  };

  // One function for the × button and the checkbox.
  const handleRemoveTile = useCallback((id: string): void => {
    setState((current) => {
      const result = current.layout ? removeTile(current.layout, id) : undefined;
      if (!result) return current;
      return {
        layout: result.layout,
        removed: [...current.removed.filter((item) => item.tile.id !== id), result.removed],
      };
    });
  }, []);

  const handleRestoreTile = (id: string): void => {
    setState((current) => {
      const item = current.removed.find((candidate) => candidate.tile.id === id);
      if (!item || !current.layout) return current;
      return { layout: restoreTile(current.layout, item), removed: current.removed.filter((other) => other !== item) };
    });
  };

  const handleFlexChange = (id: string, flex: TileFlex): void => {
    setState((current) => ({ ...current, layout: current.layout && withFlex(current.layout, id, flex) }));
  };

  const tileActions = useMemo(() => ({ removeTile: handleRemoveTile }), [handleRemoveTile]);

  const handleSchemeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = event.target.value === "light" ? "light" : "dark";
    setScheme(next);
    setTheme((current) => ({ ...current, ...SCHEME_COLORS[next] }));
  };

  const handleThemeChange = (key: keyof ThemeState) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value, type } = event.target;
    setTheme((current) => ({ ...current, [key]: type === "range" ? Number(value) : value }));
  };

  const workspaceTheme: WorkspaceTheme = { ...theme, dividerActiveColor: "#4f7cff" };

  return (
    <div className="demo-app" style={{ colorScheme: scheme }}>
      <aside className="demo-sidebar">
        <nav aria-label="Layouts">
          {EXAMPLES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === example?.id}
              className="demo-nav-item"
              onClick={() => handleSelect(item)}
            >
              {item.title}
            </button>
          ))}
        </nav>

        <fieldset className="demo-controls">
          <legend>Theme</legend>
          <label>
            Scheme
            <select value={scheme} onChange={handleSchemeChange}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <RangeControl label="Gap" value={theme.gap} max={32} onChange={handleThemeChange("gap")} />
          <RangeControl label="Radius" value={theme.radius} max={32} onChange={handleThemeChange("radius")} />
          <RangeControl label="Padding" value={theme.padding} max={48} onChange={handleThemeChange("padding")} />
          <ColorControl label="Background" value={theme.background} onChange={handleThemeChange("background")} />
          <ColorControl label="Tile" value={theme.tileBackground} onChange={handleThemeChange("tileBackground")} />
          <ColorControl label="Divider" value={theme.dividerColor} onChange={handleThemeChange("dividerColor")} />
        </fieldset>

        {layout && cards.length > 0 ? (
          <CardControls
            cards={cards}
            layout={layout}
            removed={removed}
            onRemove={handleRemoveTile}
            onRestore={handleRestoreTile}
            onFlexChange={handleFlexChange}
          />
        ) : null}

        <div className="demo-json">
          <textarea
            aria-label="Layout JSON"
            aria-invalid={errors.length > 0}
            aria-describedby={errors.length > 0 ? JSON_ERRORS_ID : undefined}
            spellCheck={false}
            value={text}
            onChange={handleJsonChange}
          />
          {errors.length > 0 ? (
            <ul id={JSON_ERRORS_ID} className="demo-json-errors">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </aside>

      <main className="demo-main">
        {layout ? (
          <TileActionsContext value={tileActions}>
            <Workspace layout={layout} modules={MODULES} theme={workspaceTheme} onLayoutChange={handleLayoutChange} />
          </TileActionsContext>
        ) : null}
      </main>
    </div>
  );
}

function formatLayout(layout: Layout | undefined): string {
  return layout ? JSON.stringify(layout, null, 2) : "";
}

function errorsOf(text: string): string[] {
  const result = parseJsonLayout(text);
  return "errors" in result ? result.errors : [];
}

function parseJsonLayout(text: string): JsonLayoutResult {
  try {
    const result = parseLayout(JSON.parse(text));
    if (result.ok) return { layout: result.layout };
    return { errors: result.errors.map(({ path, message }) => `${path}: ${message}`) };
  } catch (error: unknown) {
    return { errors: [error instanceof Error ? error.message : "Invalid JSON"] };
  }
}

interface RangeControlProps {
  label: string;
  value: number;
  max: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function RangeControl({ label, value, max, onChange }: RangeControlProps) {
  return (
    <label>
      {label}
      <input type="range" min={0} max={max} value={value} onChange={onChange} />
      <output>{value}</output>
    </label>
  );
}

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function ColorControl({ label, value, onChange }: ColorControlProps) {
  return (
    <label>
      {label}
      <input type="color" value={value} onChange={onChange} />
    </label>
  );
}
