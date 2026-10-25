# Tessera — Claude Code Instructions

## Overview

Tessera is a cross-platform desktop workspace (Electron + React 19 + TypeScript). The UI is a **skeleton**: a tiling layout. **Modules** attach to **tiles**. Tiles resize. Layouts are saved as **views** (JSON files).

Tessera is generic. Aftrad work (Jira, Task solver, Docker, GitHub, Git log, Notes, TODO, Slack, Docs) is one set of modules, not the whole app.

- Origin: rebuild of AftradUI (`~/Projects/aftrad-ui`, SwiftUI, macOS only). Do not edit the old app. It stays the daily tool until Tessera covers it.
- When you port an Aftrad screen, its spec is the source of truth: `~/Projects/aftrad-ui/docs/screens/<screen>.md`.
- Full background and plan: `~/Projects/aftrad-ui/docs/electron-handoff.md`.
- Platforms: macOS and Linux first. Windows later (the user's zsh tools need WSL or Git Bash there). Do not use macOS-only APIs without a Linux path.
- Top concerns, in order: (1) performance and smoothness, (2) embedded terminals, (3) clean modular design.

## Architecture & File Structure

```
src/
  main/              -> Main process: services (shell/pty, git, gh, jira, slack, docker, keychain, stores), IPC handlers
  preload/           -> Exposes a small typed API to the renderer (window.api). Nothing else
  shared/            -> Types used by main, preload and renderer (IPC channel map, API types). No runtime deps on Node or DOM
  renderer/src/
    skeleton/        -> Tiling layout. Knows nothing about GitHub, Jira, etc.
    modules/<name>/  -> One module: components, store, lib, manifest
    stores/          -> Domain stores shared by modules (scope-aware)
    components/
      ui/            -> Low-level UI primitives (no business logic)
      shared/        -> Components shared across modules
    lib/             -> Utilities (cn, constants)
layouts/             -> Built-in views as JSON
```

- **Path aliases**: `@/*` → `src/renderer/src/*`. `@shared/*` → `src/shared/*`. Use them for cross-folder imports. Relative imports only inside the same module folder.
- **Process security**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Never expose `ipcRenderer` itself to the renderer. Expose one typed function per action.
- `src/shared/` must not import from `electron`, Node or React. The renderer compiles it without Node types.

### Module rules

- **No business logic in modules.** Modules call services in the main process through typed IPC.
- Each module has a **manifest**: `id`, `title`, default size, needed data/scope, events it emits. The skeleton reads only the module registry and the layout file.
- **View** = JSON split tree. Each leaf names a module and its props.
- Communication between modules:
  1. Domain stores (Zustand) for state. Read with granular selectors.
  2. Main-process services through IPC.
  3. A small event bus for one-time actions only ("open file X in the diff"). Never for state.
- **Scope**: each view (or tile group) has its own context scope. Two views of the same module type must not share state by mistake.
- A module with a missing dependency shows a clear empty state ("No PR selected").

## App rules (from AftradUI, still valid)

- **Shell safety**: run commands as executable + argument array (`spawn(cmd, args)`). Never `zsh -c "<string with user input>"`, never `shell: true` with user input.
- **Console echo**: every command the app runs is echoed to a console panel (stdout and stderr). Polling loops log only on first run and on change.
- **Confirmations**: mutating commands (git push, PR create/merge, deploy, docker prune) need an explicit click. The big ones need a confirmation dialog that shows the exact command. Setting "Ask before running commands" is on by default. Deleting data always asks.
- **Secrets** (Jira token, Slack tokens): OS keychain only, through Electron `safeStorage`. Never log them. Never put them on a command line or in renderer state that persists.
- Production deploy stays disabled.
- Deploy and `lane down` are typed into a terminal tile (interactive zsh functions). The app never runs `lane up`.
- **Languages**: English and Spanish, runtime switch. English text is the key. Spanish: Spain, short, "tú", dev terms stay English.
- **Themes**: dark is the default, light exists. Colors per area use palettes (app, github, jira, slack) as token sets. Never hardcode colors in views.
- **Safe links**: links from other people's content (Slack, Jira, notes) open only through an allowlist. The main window denies all new windows by default.

## Naming Conventions

- **Filenames**: always **kebab-case** for files and folders (`pr-list.tsx`, `terminal-store.ts`). ESLint (`check-file`) enforces it in `src/`, except `src/renderer/src/components/ui/`.
- **Components**: **PascalCase** function names (`export function PrList()`).
- **Constants**: `SCREAMING_SNAKE_CASE` for true constants.
- **Booleans**: prefix with `is`, `has`, `can`, `should` or `show`. `show` is only for UI visibility.
- **Exports**: named exports for components. The main component is the first function in the file. Helpers go below. `export default` only where a tool needs it.
- **Quotes**: double quotes (Prettier).

## State Management (Zustand)

- Module stores: `src/renderer/src/modules/<name>/store/<name>-store.ts`. Shared domain stores: `src/renderer/src/stores/`.
- Use `persist` + `partialize` only for data that must survive restarts. Never persist transient state (`isLoading`, `activeModal`).
- Always select granular slices:
  ```tsx
  // Correct
  const prs = usePrStore((state) => state.prs);

  // Bad: re-renders on any store change
  const { prs } = usePrStore();
  ```
- Many tiles means many renders. Use selectors and virtualization (`@tanstack/react-virtual`) for long lists from the start.

## Code Style

- **Readability over cleverness.**
- **Declarative over imperative.** Use `.map()`, `.filter()`, `.find()`, `.some()`. No `for...of` or `for` loops.
- **Simple reduces.** If a `.reduce()` gets complex, extract a pure named helper.
- **No comments by default.** Add one short line only when the _why_ is not obvious: magic values, hidden constraints, cross-file coupling, timing workarounds.
- **Early returns.** Handle edge cases at the top. Keep the happy path at the lowest indent.
- **Lookup tables over conditionals** for long `if/else` or `switch` chains.
- **Orchestrator pattern.** A main function calls smaller atomic functions.
- **Do not export** a function unless another file needs it.
- For complex domains (state machines, cascading rules): pure reducer layer (`model`, `actions`, `reducer`, `deriveUi`) wrapped in a hook.

## TypeScript Standards

- `interface` for object shapes, props and API contracts. `type` for unions, tuples and utility types.
- **No `any`.** Use `unknown` and narrow.
- No native `enum`. Use string unions or `as const`.
- Avoid `as`. Prefer type guards and `satisfies`. If `as` is necessary, add a `// SAFETY:` comment. Never `as any`, `as unknown as T` or `@ts-ignore`.
- Explicit types where they help readability (function returns, store shapes, IPC contracts).
- Map raw external data (gh JSON, Jira API) to typed domain models inside main-process services, before it reaches the renderer.

## Error Handling

- Wrap every `await` in `try/catch`. No unhandled promise rejections. Use `void` for intentional fire-and-forget.
- `catch` receives `unknown`. Narrow before you read `.message`.
- Never show raw error messages to the user. Map them to clear messages in the store or hook.

## React

- Event handlers: `handle[Event]` (`handleClick`).
- Derived state: `useMemo` or computed values, not `useEffect` + `setState`.
- Props: always a named `interface`.

## Styling & Design

- Tailwind CSS 4 with semantic tokens (CSS variables in `src/renderer/src/assets/main.css`). Never raw hex values or arbitrary Tailwind colors in views.
- Conditional classes: always `cn(...)` (`@/lib/cn`).
- Icons: `lucide-react`.
- UI primitives in `components/ui/` have `data-slot` attributes.
- Motion: `motion` library. Use shared spring constants (to be ported from smart-tutor `panelMotion.ts`), not ad-hoc values per component.

### Surface hierarchy

| Level       | Background      | Border                      | Shadow        | Examples                  |
| ----------- | --------------- | --------------------------- | ------------- | ------------------------- |
| **Page**    | `bg-background` | —                           | —             | Skeleton canvas           |
| **Card**    | `bg-card`       | `border-border`             | `shadow-card` | Tiles, tables, list items |
| **Overlay** | `bg-popover`    | `ring-1 ring-foreground/10` | varies        | Dialogs, menus, tooltips  |

- Do not mix the levels (no `shadow-card` on overlays, no `ring-foreground/10` on cards).
- Only `shadow-card` on cards. No `shadow-sm` / `shadow-md` / `shadow-lg`.
- `ring-primary` only for interactive states (selected, focused), never as a resting border.
- Hover on clickable cards: background shift (`hover:bg-muted/50`). Do not change the border.
- Flat sections with dividers (`divide-y divide-border`) for settings and form groups, not cards.
- A new theme defines its own `--shadow-card` and `--border` if the defaults do not fit.

## Feedback

- Toasts for short success/error messages.
- Destructive actions: always a confirmation dialog.
- Loading: skeleton placeholders over full-screen spinners.

## Testing & Tooling

- Vitest for pure functions, stores and data mapping (`src/**/*.test.ts`).
- `make check` runs oxlint, ESLint (type-aware), type-check (main + preload + renderer) and tests. It must pass before you hand over work.
- `make dev` starts the app with HMR. `make build` makes a production build in `out/`.
- After `npm install`, `postinstall` downloads the Electron binary (`install-electron`) and rebuilds native deps (`electron-builder install-app-deps`). Native modules (`node-pty`) need this per OS.
- Check current versions with `npm view <pkg> version` before you add a package. TypeScript stays on `~6.0` until `typescript-eslint` supports 7. ESLint stays on 9 until `eslint-plugin-import` and `jsx-a11y` support 10.

## Docs & Tracking

| File                         | Git     | Use                                                                                                                       |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docs/README.md`             | public  | Index of docs. One doc per area (skeleton, modules, IPC, terminal), about the current state                               |
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
  - `type`: `feat` (new behavior the user sees), `fix` (bug fix), `refactor` (same behavior, better code), `perf` (faster or less memory), `docs`, `test`, `chore` (setup, deps, config), `build` (packaging, electron-builder), `ci`.
  - `scope` (optional): the area, lowercase. Examples: `skeleton`, `terminal`, `ipc`, `modules`, a module name (`github`), `deps`.
  - `summary`: imperative ("add", not "added"), lowercase start, no period. Full title max 72 characters.
  - Examples: `feat(skeleton): add tiling layout with saved views (TES-2)`, `chore: set up electron-vite, lint and docs (TES-1)`.
- **CLOSEOUT** (`/end-task`): line 1 is `# Closeout: <ID> — <PR title>`, with the full PR title above (`(TES-<n>)` included): `create-pr` uses it as it is. In `## Commit description`, the first line is the same PR title. The body is 2–5 lines: what changed and why.
- **Format command**: `npm run format:branch`, then `make check`.
- **Audit**: `/audit-nextjs` on the files of the branch, with the rules in `.claude/AUDIT.md`. Skip the Next.js-only checks.
- **Merge**: squash merge on GitHub. The user pushes, opens the PR and merges.

## Working rules

- Claude does not commit, stage, push, checkout or delete branches. The user does.
- Minimal targeted diffs. Do not rewrite what does not need a change.
- Use `rg` (not `grep`) and `fd` (not `find`).
- Act as a critical partner. Flag missing context or blockers before you continue. If a request is not optimal, give short pros/cons and propose the alternative.
- If you choose a complex path for performance, explain the trade-off.
