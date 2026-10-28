# Workspace

```tsx
<Workspace layout={layout} modules={MODULES} theme={theme} onLayoutChange={save} />
```

The `Workspace` fills its parent (`width: 100%; height: 100%`). Give the parent a size.

## Props

| Prop             | Type                              | Use                                                                                     |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `layout`         | `Layout`                          | The tile tree. See [layout.md](layout.md)                                               |
| `modules`        | `Record<string, ComponentType>`   | Module id → React component                                                             |
| `theme`          | `WorkspaceTheme`                  | Colours and spacing. See [Theme](#theme)                                                |
| `onLayoutChange` | `(layout: Layout) => void`        | Called with the new layout at the end of a divider drag, a divider key press or a reset |
| `renderUnknown`  | `(moduleId: string) => ReactNode` | Renders a tile whose module id is not in `modules`. Default: "Unknown module: <id>"     |
| `labels`         | `{ divider?, unknownModule? }`    | The text the workspace shows. English by default                                        |
| `className`      | `string`                          | Added to the root element                                                               |

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
| `tileShadow`         | `--tessera-tile-shadow`          | `none`                                                     |
| `dividerColor`       | `--tessera-divider-color`        | `transparent`                                              |
| `dividerActiveColor` | `--tessera-divider-active-color` | `Highlight` (hover, focus and drag of a resizable divider) |

- The defaults use CSS system colours, so they follow the page `color-scheme` (dark or light).
- The tile border is drawn on top of the module. It does not take space.
- Tessera styles only its own elements (`.tessera-*`), never the module content.

## Resizing

A split with `resizable: true` has draggable dividers. A split without it has fixed dividers.

- **Pointer**: drag a divider. Only the two tiles next to it change.
- **Keyboard**: a divider is a focusable `separator`. Arrow keys move it 10px. `Home` and `End` move it to the limit.
- **Double-click**: resets the split to the sizes in the `layout` prop.
- A share stays a share and a length keeps its unit (a `%` stays `%`, other units become `px`). So the result of `onLayoutChange` is a valid layout that renders the same.
- `minSize` limits the drag. With no `minSize`, a tile in a resizable split stops at `48px`.
- During a drag, the modules do not render again. `onLayoutChange` is called once, at the end.

### Layout prop and resized sizes

The `Workspace` keeps the resized sizes in its own state. A new `layout` object (a different identity) replaces that state.

- To keep the user's sizes, give the `Workspace` the same `layout` object. Save the `onLayoutChange` value separately.
- To restore saved sizes, give the saved layout as `layout` when the workspace starts.
- If you give the `onLayoutChange` value back as `layout`, the double-click reset goes to the newest sizes.

## Module state

A module is a normal React component. Its state stays while the layout keeps the tile at the same place in the tree: a resize does not change it.

When a new layout moves a tile to a different place, or removes it, React unmounts the module and its state goes. Keep state that must stay in a store outside the module.
