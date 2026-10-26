import { useState, type ChangeEvent } from "react";

import { Workspace, type Layout, type WorkspaceTheme } from "tessera";

import { EXAMPLES, type Example } from "./layouts";
import { MODULES } from "./modules";

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

export function App() {
  const [example, setExample] = useState<Example | undefined>(FIRST_EXAMPLE);
  const [output, setOutput] = useState<Layout | undefined>(FIRST_EXAMPLE?.layout);
  const [scheme, setScheme] = useState<ColorScheme>("dark");
  const [theme, setTheme] = useState<ThemeState>(INITIAL_THEME);

  const handleSelect = (next: Example): void => {
    setExample(next);
    setOutput(next.layout);
  };

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

        <pre className="demo-json" aria-label="Layout JSON">
          {JSON.stringify(output, null, 2)}
        </pre>
      </aside>

      <main className="demo-main">
        {example ? (
          <Workspace layout={example.layout} modules={MODULES} theme={workspaceTheme} onLayoutChange={setOutput} />
        ) : null}
      </main>
    </div>
  );
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
