# Layout

A layout is a plain object (valid JSON). It describes the tile tree. The `Workspace` renders it.

```ts
interface Layout {
  version?: 1;
  root: Tile;
}

type Tile = ModuleTile | WindowsTile | SplitTile | SpacerTile;

interface ModuleTile extends TileCommon, TileAppearance {
  module: string; // id in the modules map
  props?: object; // React props of the module
}

interface WindowsTile extends TileCommon, TileAppearance {
  windows: { module: string; props?: object }[]; // at least one
}

interface SplitTile extends TileCommon {
  split: "row" | "column";
  children: Tile[]; // at least one
  resizable?: boolean; // default false
}

interface SpacerTile {
  spacer: true;
  size?: TileSize;
  id?: string;
}

interface TileCommon {
  id?: string; // unique among the siblings
  size?: TileSize;
  minSize?: CssLength;
  flex?: "grow" | "static" | "pack"; // default "grow"
  background?: string;
}

interface TileAppearance {
  radius?: string | number; // a number is px
  borderWidth?: string | number;
  borderColor?: string;
  elevation?: 0 | 1 | 2 | 3 | 4;
}
```

- `background` on a tile overrides the theme's `tileBackground` for that tile. Use `"transparent"` to show the workspace background.
- `id` keeps a tile (and its module state) when the layout prop changes and a sibling is removed. Two siblings in one split cannot have the same `id`. A tile with no `id` is matched by its place in the split, so give an `id` to every tile that can be removed.
- A tile has one kind: `module`, `windows`, `split` or `spacer`. `module` and `windows` together is an error.

## Appearance

A module tile or a tile with windows can set its own look. A value that is not set uses the [theme](workspace.md#theme).

| Key           | Meaning                                                                                 | Theme fallback          |
| ------------- | --------------------------------------------------------------------------------------- | ----------------------- |
| `radius`      | Corner radius. A number is px                                                           | `radius`                |
| `borderWidth` | Border width. A number is px                                                            | `tileBorder`            |
| `borderColor` | Border colour                                                                           | `tileBorder`            |
| `elevation`   | Shadow level. `0` is no shadow. `1` to `4` use the theme's `elevation1` to `elevation4` | `tileShadow` (no level) |

- A tile that sets `borderWidth` or `borderColor` draws its own border. The value it does not set is `1px` or CanvasText at 15%, not the `tileBorder` value.
- The border does not take space, with or without these keys.

## Spacer

`{ spacer: true, size: "240px" }` is an empty, invisible tile. It holds space in a split: no background, no border, no content, hidden from assistive technology. A spacer has only `spacer`, `size` and `id`.

The `Workspace` adds a spacer to the layout it sends to `onLayoutChange` when a `"static"` tile keeps its place after a sibling is removed (see [Flex](#flex)). You can also write one yourself.

## Windows

`windows` puts several modules in one tile. They sit side by side in a horizontal scroller with CSS `scroll-snap`, so a trackpad or a touch swipe pages between them.

```json
{
  "windows": [
    { "module": "note", "props": { "text": "Hello" } },
    { "module": "note", "props": { "text": "World" } }
  ]
}
```

- All windows stay mounted. A module keeps its state when the user pages away.
- With two or more windows, dots show at the bottom of the tile on hover and when the tile has focus. A click on a dot scrolls to that window. `ArrowLeft` and `ArrowRight` on a dot move to the previous or next window and move the focus.
- Smooth scroll is off with `prefers-reduced-motion`.
- The window the user sees is not part of the layout. It resets when the tile mounts again.
- A window that is not visible is `inert`, so Tab does not reach it.
- The text of the dots (`aria-label`) comes from [`labels.window`](workspace.md#props).

## Flex

`flex` sets what a tile does when a sibling is removed by a new `layout` prop. A split, a module tile and a tile with windows can set it. A spacer cannot.

| `flex`     | The tile                                   |
| ---------- | ------------------------------------------ |
| `"grow"`   | Takes the free space. This is the default  |
| `"static"` | Keeps its size and its place               |
| `"pack"`   | Keeps its size and slides to close the gap |

Rules for one split, in order:

1. A remaining sibling is `"grow"`: the `"grow"` tiles take the space. No spacer is added.
2. Else a remaining sibling is `"static"`: a spacer takes the place of the removed tile.
3. Else (all `"pack"`): the tiles move to the start of the split.

A tile animates only when it has an `id`. The `Workspace` follows tiles by `id`, so a tile with no `id` changes at once and does not animate. A root tile and a tile outside a split do not animate either. To restore a removed tile, give the layout with the tile again.

A `"static"` or `"pack"` tile with a share size freezes to its current pixel size. The `Workspace` calls `onLayoutChange` once, after the change has ended, with the frozen sizes and the spacer. So the saved JSON renders the same as the screen.

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
- It checks the module ids and `props` inside `windows` too, and that `windows` has at least one window.
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
- It reports a `module` and `windows` in one tile, an empty `windows`, a bad `flex` or `elevation`, a spacer with other keys, and two siblings with the same `id`.
