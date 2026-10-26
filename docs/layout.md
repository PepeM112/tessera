# Layout

A layout is a plain object (valid JSON). It describes the tile tree. The `Workspace` renders it.

```ts
interface Layout {
  version?: 1;
  root: Tile;
}

type Tile = ModuleTile | SplitTile;

interface ModuleTile {
  module: string; // id in the modules map
  props?: object; // React props of the module
  size?: TileSize;
  minSize?: CssLength;
  background?: string;
  id?: string;
}

interface SplitTile {
  split: "row" | "column";
  children: Tile[]; // at least one
  resizable?: boolean; // default false
  size?: TileSize;
  minSize?: CssLength;
  background?: string;
  id?: string;
}
```

- `background` on a tile overrides the theme's `tileBackground` for that tile. Use `"transparent"` to show the workspace background.
- `id` is free for your own use. Tessera does not read it.

## Sizes

`size` sets the size of a tile along the direction of its parent split. The math is the same as CSS flexbox with `gap`: the dividers take their space first, then the lengths, then the shares divide the rest.

| `size`                 | Meaning                                                   | CSS               |
| ---------------------- | --------------------------------------------------------- | ----------------- |
| number (`2`)           | A share of the free space                                 | `flex: 2 1 0`     |
| CSS length (`"240px"`) | A fixed length. Units: `px`, `%`, `rem`, `em`, `vw`, `vh` | `flex: 0 1 240px` |
| not set                | Share `1`                                                 | `flex: 1 1 0`     |

- A `%` length is a percent of the split's inner size, dividers included (the CSS flex-basis rule).
- A length stays the same when the window changes size. Only the shares grow and shrink.
- `minSize` is a CSS length. In a resizable split, a tile with no `minSize` uses `48px`, so a drag cannot close it.
- A tile at the root has no parent split, so its `size` has no effect.

## `defineLayout`

`defineLayout(modules, layout)` returns the layout as it is. It only adds types: TypeScript then checks each module id and its `props` against the component in the `modules` map.

```ts
const MODULES = { note: Note }; // Note: ({ title }: { title: string }) => ...

defineLayout(MODULES, { root: { module: "note", props: { title: "A" } } }); // OK
defineLayout(MODULES, { root: { module: "notes" } }); // error: unknown module id
defineLayout(MODULES, { root: { module: "note" } }); // error: props.title is required
```

- A module with only optional props can leave `props` out.
- Use it for layouts in code. For a layout from a file or storage, use `parseLayout`.

## `parseLayout`

`parseLayout(value: unknown)` checks a value from outside (a JSON file, `localStorage`, an API) before you give it to the `Workspace`.

```ts
const result = parseLayout(JSON.parse(text));
if (result.ok) render(result.layout);
else console.error(result.errors); // [{ path: "root.children[1].size", message: "..." }]
```

- It returns all errors, each with the path of the bad value.
- An unknown key is an error, so a typo (`sise`) does not fail silently.
- It does not check module ids: the `Workspace` shows an "Unknown module" tile for an id that is not in `modules`.
- It does not check `props`. The module gets them as they are.
