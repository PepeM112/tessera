# Workspace

```tsx
<Workspace layout={layout} modules={MODULES} theme={theme} onLayoutChange={save} />
```

The `Workspace` fills its parent (`width: 100%; height: 100%`). Give the parent a size.

## Props

| Prop             | Type                                    | Use                                                                                                                                                                              |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`         | `Layout`                                | The tile tree. See [layout.md](layout.md)                                                                                                                                        |
| `modules`        | `Record<string, ComponentType>`         | Module id → React component                                                                                                                                                      |
| `theme`          | `WorkspaceTheme`                        | Colours and spacing. See [Theme](#theme)                                                                                                                                         |
| `onLayoutChange` | `(layout: Layout) => void`              | Called with the new layout at the end of a divider drag, a divider key press or a reset                                                                                          |
| `renderUnknown`  | `(moduleId: string) => ReactNode`       | Renders a tile whose module id is not in `modules`. Default: "Unknown module: <id>"                                                                                              |
| `labels`         | `{ divider?, unknownModule?, window? }` | The text the workspace shows. English by default. `window` is `(position, total) => string` for the `aria-label` of a window dot ("Window 2 of 3"). Define it outside the render |
| `className`      | `string`                                | Added to the root element                                                                                                                                                        |

- Define `modules` outside the render (a module constant). A new object on each render renders every module again.
- The `Workspace` has no global state. Two workspaces on one page do not share anything.
- It does not read `window` or `document` at import time, so a server render does not fail.

## Theme

Each `theme` key sets a `--tessera-*` CSS variable on the root element. A number is px. A key that is not set uses the default from `tessera/styles.css`. You can also set the variables in your own CSS on any ancestor.

| Key                  | CSS variable                     | Default                                                    |
| -------------------- | -------------------------------- | ---------------------------------------------------------- |
| `background`         | `--tessera-background`           | `transparent`                                              |
| `padding`            | `--tessera-padding`              | `8px`                                                      |
| `gap`                | `--tessera-gap`                  | `8px`                                                      |
| `radius`             | `--tessera-radius`               | `8px`                                                      |
| `tileBackground`     | `--tessera-tile-background`      | `Canvas`                                                   |
| `tileBorder`         | `--tessera-tile-border`          | `1px solid` CanvasText at 15%                              |
| `tileShadow`         | `--tessera-tile-shadow`          | `none` (shadow of a tile with no `elevation`)              |
| `elevation1`         | `--tessera-elevation-1`          | Soft shadow, 1px offset                                    |
| `elevation2`         | `--tessera-elevation-2`          | Soft shadow, 2px and 4px offsets                           |
| `elevation3`         | `--tessera-elevation-3`          | Soft shadow, 4px and 8px offsets                           |
| `elevation4`         | `--tessera-elevation-4`          | Soft shadow, 8px and 16px offsets                          |
| `transitionDuration` | `--tessera-transition-duration`  | `240ms`                                                    |
| `transitionEasing`   | `--tessera-transition-easing`    | `cubic-bezier(0.22, 1, 0.36, 1)`                           |
| `dividerColor`       | `--tessera-divider-color`        | `transparent`                                              |
| `dividerActiveColor` | `--tessera-divider-active-color` | `Highlight` (hover, focus and drag of a resizable divider) |

- The defaults use CSS system colours, so they follow the page `color-scheme` (dark or light).
- The tile border is drawn on top of the module. It does not take space.
- A tile can set its own `radius`, `borderWidth`, `borderColor` and `elevation`. See [Appearance](layout.md#appearance).
- `elevation1` to `elevation4` are the shadows of the tile `elevation` levels. The workspace clips a shadow at its edge, so give a large shadow enough `padding`.
- `transitionDuration` and `transitionEasing` set the time and the easing of the animations the workspace plays (the window dots and the tile changes). They are CSS values, so a number is not allowed.
- Tessera styles only its own elements (`.tessera-*`), never the module content.

## Resizing

A split with `resizable: true` has draggable dividers. A split without it has fixed dividers.

- **Pointer**: drag a divider. Only the two tiles next to it change.
- **Keyboard**: a divider is a focusable `separator`. Arrow keys move it 10px. `Home` and `End` move it to the limit.
- **Double-click**: resets the split to the sizes of the last layout that you set as `layout`, plus the changes that a removal made (see [Animation](#animation)). A fed-back `onLayoutChange` value does not count as a layout that you set.
- A share stays a share and a length keeps its unit (a `%` stays `%`, other units become `px`). So the result of `onLayoutChange` is a valid layout that renders the same.
- `minSize` limits the drag. With no `minSize`, a tile in a resizable split stops at `48px`.
- During a drag, the modules do not render again. `onLayoutChange` is called once, at the end.

### Layout prop and resized sizes

The `Workspace` keeps the resized sizes in its own state. A new `layout` object (a different identity) replaces that state.

- To keep the user's sizes, give the `Workspace` the same `layout` object, or give the `onLayoutChange` value back as `layout`.
- To restore saved sizes, give the saved layout as `layout` when the workspace starts.
- If you give the `onLayoutChange` value back as `layout`, the `Workspace` ignores it: the sizes stay, nothing animates, and the double-click reset still goes to the sizes of the last layout that you set.
- The match is by object identity (`===`) with the last value that `onLayoutChange` sent. It holds until you give another layout. A copy, even an equal one, is a new layout: it resets the sizes and becomes the reset target.

## Animation

A new `layout` prop moves the tiles with a CSS transition. A tile with an `id` that enters grows from size 0 and fades in. A tile that leaves fades out and shrinks to size 0 (or keeps its size, see [Flex](layout.md#flex)). A tile that changes size moves to its new size. The browser does the work, so the modules do not render again.

- `transitionDuration` and `transitionEasing` in the [theme](#theme) set the time and the easing.
- A drag, a key press or a double-click on a divider moves the tiles at once, with no transition.
- A theme change (for example `gap`) is at once.
- With `prefers-reduced-motion: reduce` every change is at once.
- A tile that leaves stays in the DOM until its transition ends. Its module is mounted until then.
- When a removal froze sizes or added a spacer, `onLayoutChange` is called once, after the transition ends. A removal where only `"grow"` tiles stay gives no call. If you give the written layout back as `layout`, the `Workspace` ignores it: nothing moves and no module mounts again. The written sizes and spacers also become part of the double-click reset target.
- A tile with a user drag that starts in the middle of a transition starts from the sizes on the screen.

## `useTile`

`useTile()` returns `{ id, path }` of the tile that holds the calling module. `id` is the `id` of the tile in the layout (`undefined` if it has none). `path` is the child indexes from the root, joined with dots (the root is `""`).

```tsx
function Card() {
  const { id } = useTile();
  return <button onClick={() => remove(id)}>Close</button>;
}
```

- Call it only in a module that a `Workspace` renders. Anywhere else it throws an error: `useTile works only inside a module that a <Workspace> renders`.
- In a tile with windows, every window gets the same tile.

## Module state

A module is a normal React component. Its state stays while the layout keeps the tile at the same place in the tree: a resize does not change it.

A tile with an `id` keeps its module and its state when a new layout changes the order of its siblings or removes one of them. A tile with no `id` is matched by its place in the split.

When a new layout moves a tile to a different split, or removes it, React unmounts the module and its state goes. Keep state that must stay in a store outside the module.
