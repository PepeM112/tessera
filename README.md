# Tessera

React tiling layout. A **Workspace** renders a **Layout** (a config object) as **Tiles**. Each tile holds a **Module** (your React component) or is a **Split** into more tiles. **Dividers** between tiles are fixed, or resizable per split.

```tsx
import { Workspace, defineLayout } from "tessera";
import "tessera/styles.css";

const MODULES = { nav: Nav, editor: Editor, info: Info };

const LAYOUT = defineLayout(MODULES, {
  root: {
    split: "row",
    resizable: true,
    children: [
      { module: "nav", size: "240px" },
      {
        split: "column",
        children: [
          { module: "editor", props: { file: "a.ts" }, size: 3 },
          { module: "info", size: 1 },
        ],
      },
    ],
  },
});

export function App() {
  return (
    <div style={{ height: "100vh" }}>
      <Workspace layout={LAYOUT} modules={MODULES} theme={{ gap: 8, radius: 8 }} />
    </div>
  );
}
```

## Terms

| Term          | Meaning                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Workspace** | The React component. It renders one layout and fills its parent                           |
| **Layout**    | The config object: `{ version?: 1, root: Tile }`. Plain JSON, so you can save and load it |
| **Tile**      | One area of the workspace. The root is a tile. A tile is a module tile or a split tile    |
| **Module**    | A React component in the `modules` map. A module tile names it by id and gives it `props` |
| **Split**     | A tile divided into child tiles in a `row` or a `column`                                  |
| **Divider**   | The gap between two tiles in a split. Fixed by default, draggable with `resizable: true`  |

## Docs

- [Layout](docs/layout.md): the config, sizes, `defineLayout`, `parseLayout`.
- [Workspace](docs/workspace.md): props, theme, resizing, state.

## Development

```sh
npm install
make dev     # playground with example layouts and demo modules
make check   # oxlint, eslint, type-check, tests
make build   # library build in dist/
make pack    # build + list the files of the npm package
```

Code rules: `CLAUDE.md`.
