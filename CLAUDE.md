# Tessera — Claude Code Instructions

## Overview

Tessera is a **React tiling layout library**. A **Workspace** renders a **Layout** config as **Tiles**. A tile holds a **Module** (a React component from the `modules` map prop) or is a **Split** (row or column) into more tiles. **Dividers** between tiles are fixed by default, or resizable per split.

- Layouts come from config. A new `layout` prop from outside animates (tiles removed, added or resized). The library has no runtime rearranging of its own (no drag-and-drop of tiles, no tabs, no docking).
- The library has no app logic. An app (for example the future AftradUI port) installs it and gives its own modules.
- Top concerns, in order: (1) performance and smooth resizing, (2) a small, typed, predictable API, (3) clean code.

### Terms

Use these words in code, docs and UI text. Do not use synonyms (panel, pane, view, widget, sash, gutter).

| Term          | Meaning                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Workspace** | The React component. It renders one layout and fills its parent                           |
| **Layout**    | The config object `{ version?: 1, root: Tile }`. Plain JSON                               |
| **Tile**      | One area. The root is a tile. A tile is a module tile or a split tile                     |
| **Module**    | A React component in the `modules` map. A module tile names it by id and gives it `props` |
| **Split**     | A tile divided into child tiles in a `row` or a `column`                                  |
| **Divider**   | The gap between two tiles in a split. Fixed, or draggable with `resizable: true`          |
| **Window**    | One of several modules in a module tile. The windows scroll side by side, with dots       |
| **Spacer**    | An empty, invisible tile that holds the place of a removed tile (`{ spacer: true }`)      |

## Architecture & File Structure

```
src/                   -> The library. Everything in here is published (except tests and *.typecheck.ts)
  index.ts             -> Public API. Export only what a consumer needs
  workspace.tsx        -> Workspace component: layout state, resize/reset, context
  tile-node.tsx        -> Renders one tile (split or module), recursive
  divider.tsx          -> Divider element (role separator)
  module-view.tsx      -> Renders one module (memoized), used by tiles and windows
  window-pager.tsx     -> Windows of one tile: scroll-snap scroller and dots
  use-split-resize.ts  -> Pointer and keyboard resizing of one split
  use-tile.ts          -> useTile() hook and the tile context
  tile-presence.ts     -> Pure: leaving/entering tiles and the removal rules (spacer, frozen sizes)
  use-tile-presence.ts -> Hook: follows the children of a split, measures, finishes the exit animation
  use-pointer-drag.ts  -> Pointer capture helper
  workspace-context.ts -> Context shared by the tiles of one workspace
  layout.ts            -> Layout types, defineLayout, parseLayout, tree helpers
  size.ts              -> Size types and pure size math
  theme.ts             -> WorkspaceTheme → --tessera-* CSS variables
  styles.css           -> All library CSS (shipped as tessera/styles.css)
playground/            -> Dev app (make dev): example layouts, demo modules, theme controls, JSON view
e2e/                   -> Playwright tests on the playground (make e2e). Config: playwright.config.ts
docs/                  -> Public docs, one per area
```

- **Imports in `src/`**: relative only. The playground imports the library as `tessera` and `tessera/styles.css` (path aliases), like a consumer.
- **Peer deps**: `react` and `react-dom` `^19`. No runtime dependencies. Do not add one without a strong reason.
- **No global state**: two workspaces on one page share nothing. State lives in the `Workspace` and its context.
- **No `window` or `document` access at import time.** Only inside effects and event handlers.
- **No styling of module content.** Tessera styles only its own `.tessera-*` elements.

### Library rules

- The size math is the same as CSS flexbox with `gap`: a share is `flex: n 1 0`, a length is `flex: 0 1 <length>`. Keep `size.ts` pure and tested.
- A resize must not render modules again. During a drag, only the tiles on the path to the resized split render. `onLayoutChange` is called once, at the end.
- The output of `onLayoutChange` must parse with `parseLayout` and render the same.
- A layout from outside goes through `parseLayout`. Errors carry a path (`root.children[1].size`).
- An unknown module id renders the unknown tile, never throws.
- Every resizable divider works with the keyboard and has an `aria-label`.

## Naming Conventions

- **Filenames**: always **kebab-case** for files and folders (`tile-node.tsx`, `use-split-resize.ts`). ESLint (`check-file`) enforces it in `src/` and `playground/`.
- **Components**: **PascalCase** function names (`export function Workspace()`).
- **Constants**: `SCREAMING_SNAKE_CASE` for true constants.
- **Booleans**: prefix with `is`, `has`, `can`, `should` or `show`. `show` is only for UI visibility.
- **Exports**: named exports. The main component is the first function in the file. Helpers go below. `export default` only where a tool needs it.
- **CSS**: classes `tessera-<element>`, variables `--tessera-<name>`, state as `data-*` attributes.
- **Quotes**: double quotes (Prettier).

## Code Style

- **Readability over cleverness.**
- **Declarative over imperative.** Use `.map()`, `.filter()`, `.find()`, `.some()`. No `for...of` or `for` loops.
- **Simple reduces.** If a `.reduce()` gets complex, extract a pure named helper.
- **No comments by default.** Add one short line only when the _why_ is not obvious: magic values, hidden constraints, cross-file coupling, timing workarounds. Public types and props get a short JSDoc line.
- **Early returns.** Handle edge cases at the top. Keep the happy path at the lowest indent.
- **Lookup tables over conditionals** for long `if/else` or `switch` chains.
- **Orchestrator pattern.** A main function calls smaller atomic functions.
- **Do not export** a function unless another file needs it.
- **Complex rules go in a pure module** with a thin hook around it, so you can test the rules without React (`tile-presence.ts` + `use-tile-presence.ts`).
- **No ticket IDs** (`TES-n`) in code, comments or test names. Describe the behavior. IDs go in commits and PRs.

## TypeScript Standards

- `interface` for object shapes, props and API contracts. `type` for unions, tuples and utility types.
- **No `any`.** Use `unknown` and narrow.
- No native `enum`. Use string unions or `as const`.
- Avoid `as`. Prefer type guards and `satisfies`. If `as` is necessary, add a `// SAFETY:` comment. Never `as any`, `as unknown as T` or `@ts-ignore`.
- Explicit types where they help readability (function returns, public API).
- **Generics for reusable helpers**, so the types of the input stay in the output. No `any` or a wide type.
- Type tests for `defineLayout` live in `src/define-layout.typecheck.ts` (`@ts-expect-error` cases). The type-check runs them.

## Error Handling

- Wrap every `await` in `try/catch`. No unhandled promise rejections. Use `void` for intentional fire-and-forget.
- `catch` receives `unknown`. Narrow before you read `.message`.
- Bad config is data, not an exception: `parseLayout` returns errors, the `Workspace` renders an unknown tile.

## React

- Event handlers: `handle[Event]` (`handleClick`).
- Derived state: `useMemo` or computed values, not `useEffect` + `setState`.
- Props: always a named `interface`.
- Memoize tile components. Keep context values stable (`useCallback`, `useMemo`), so a resize does not render the whole tree.
- The code must work in `StrictMode` (the playground uses it).

## Styling

- Plain CSS in `src/styles.css`. No Tailwind, no CSS-in-JS in the library.
- Every themable value is a `--tessera-*` variable with a default in `styles.css`. A new theme key goes in `theme.ts`, `styles.css` and `docs/workspace.md`.
- Defaults use CSS system colours (`Canvas`, `CanvasText`, `Highlight`), so they follow the page `color-scheme`.
- The playground may use raw colours: it is a demo, not the library.

## Testing & Tooling

- Vitest has two projects. `unit` runs `src/**/*.test.ts` in Node (pure size math, `parseLayout`). `browser` runs `src/**/*.test.tsx` in real Chromium (Playwright provider) with Testing Library, so render and resize tests use real layout. Do not mock `getBoundingClientRect`.
- Playwright e2e tests are in `e2e/` and run on the playground (Chromium only). The webServer always starts its own playground on port 5191 (`--strictPort`, no reuse), so a test never runs against another server. Run `make e2e`.
- First time on a machine: `npx playwright install chromium`.
- `make check` runs oxlint, ESLint (type-aware), type-check (lib + playground + e2e + node configs), unit and browser tests, and e2e. It must pass before you hand over work.
- `make dev` starts the playground. `make build` builds the library in `dist/`. `make pack` lists the npm package files (only `dist/`, `README.md`, `package.json`).
- Check current versions with `npm view <pkg> version` before you add a package. TypeScript stays on `~6.0` until `typescript-eslint` supports 7. ESLint stays on 9 until `eslint-plugin-import` and `jsx-a11y` support 10.

## Docs & Tracking

| File                         | Git     | Use                                                                                                                       |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                  | public  | What Tessera is, quick start, terms                                                                                       |
| `docs/README.md`             | public  | Index of docs. One doc per area (layout, workspace), about the current state                                              |
| `.claude/local/DECISIONS.md` | private | Each technical choice: decision, why, trade-off. Add an entry when you make a non-obvious choice                          |
| `.claude/AUDIT.md`           | private | Project audit rules                                                                                                       |
| `.claude/local/TODO.md`      | private | Short list of work to do next                                                                                             |
| `.claude/local/IDEAS.md`     | private | Open questions and ideas. Move to `DECISIONS.md` when decided                                                             |
| `.claude/local/TASK_<ID>.md` | private | Living file for one task (`/plan-task`, `/solve-task`, `/end-task`). Context dump with the exact next step at session end |

Git ignores all of `.claude/`. Never put a link to a `.claude/` file in a public doc.

Do not read `.claude/local/` files unless a task command or the user points to one.

## Task workflow configuration

Used by `/plan-task`, `/solve-task`, the audit and `/end-task`. **These rules override the defaults of those commands.**

- **Task ID**: `TES-<n>`, one number per task, in order (`TES-1` = project setup). For the next number, take the highest `TES-<n>` in `git log --oneline` and in `.claude/local/` and add 1. A second PR for the same task adds a roman suffix: `TES-4-II`.
- **Branch**: the task ID only (`TES-2`). `/solve-task`, `wt` and `create-pr` find the task from the branch name.
- **Commits on the branch**: short and free form. GitHub squashes them at merge.
- **PR title = squash commit title** (Conventional Commits): `<type>(<scope>): <summary> (TES-<n>)`
  - `type`: `feat` (new behavior the user sees), `fix` (bug fix), `refactor` (same behavior, better code), `perf` (faster or less memory), `docs`, `test`, `chore` (setup, deps, config), `build` (packaging, library build), `ci`. Add `!` after the type for a breaking API change.
  - `scope` (optional): the area, lowercase. Examples: `workspace`, `layout`, `size`, `theme`, `playground`, `deps`.
  - `summary`: imperative ("add", not "added"), lowercase start, no period. Full title max 72 characters.
  - Examples: `feat(layout): add parseLayout with error paths (TES-3)`, `chore: set up electron-vite, lint and docs (TES-1)`.
- **CLOSEOUT** (`/end-task`): line 1 is `# Closeout: <ID> — <PR title>`, with the full PR title above (`(TES-<n>)` included): `create-pr` uses it as it is. In `## Commit description`, the first line is the same PR title. The body is 2–5 lines: what changed and why.
- **Format command**: `npm run format:branch`, then `make check`. `format:branch` uses `git diff`, so it skips untracked files: run `npx eslint --fix` and `npx prettier --write` on new files directly.
- **Audit**: `/audit-nextjs` on the files of the branch, with the rules in `.claude/AUDIT.md`. Skip the Next.js-only checks.
- **Merge**: squash merge on GitHub. The user pushes, opens the PR and merges.

## Working rules

- Claude does not commit, stage, push, checkout or delete branches. The user does.
- Minimal targeted diffs. Do not rewrite what does not need a change.
- Use `rg` (not `grep`) and `fd` (not `find`).
- Act as a critical partner. Flag missing context or blockers before you continue. If a request is not optimal, give short pros/cons and propose the alternative.
- If you choose a complex path for performance, explain the trade-off.
