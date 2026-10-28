import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type TransitionEvent,
} from "react";

import {
  applyPlan,
  buildPatch,
  finishLeaving,
  followChildren,
  idKey,
  initialPresence,
  listEntries,
  planRemoval,
  tileFlex,
  type Presence,
  type PresenceEntry,
} from "./tile-presence";
import { mainSize, tileElements } from "./use-split-resize";
import { useWorkspaceContext } from "./workspace-context";

import type { SplitTile } from "./layout";
import type { SplitDirection } from "./size";

// The timer is a fallback for a missed `transitionend`. It waits a little longer than the transition itself.
const FALLBACK_MARGIN_MS = 100;

interface TilePresence {
  /** The children to render, with the tiles that leave still at their place. */
  entries: PresenceEntry[];
  handleTransitionEnd: (event: TransitionEvent<HTMLElement>) => void;
}

/**
 * Keeps a tile that is removed from the layout in the DOM until its exit animation ends. When the animation
 * starts, it measures the other tiles once and applies the removal rules (see `planRemoval`). When it ends, it
 * sends the frozen sizes and the spacer to the Workspace.
 */
export function useTilePresence(
  split: SplitTile,
  path: string,
  containerRef: RefObject<HTMLDivElement | null>,
): TilePresence {
  const { commitSplit } = useWorkspaceContext();
  const [state, setState] = useState(() => initialPresence(split.children));
  // Derived state: a new layout updates the presence during render, so the leaving tile never misses a commit.
  const presence = followChildren(state, split.children);
  if (presence !== state) setState(presence);
  const entries = useMemo(() => listEntries(presence, split.children), [presence, split.children]);

  // The ref gets a change at once, so two events before the next render do not lose one.
  const latest = useRef({ presence, entries });
  useLayoutEffect(() => {
    latest.current = { presence, entries };
  });

  const update = useCallback((next: Presence): void => {
    latest.current = { ...latest.current, presence: next };
    setState(next);
  }, []);

  const finish = useCallback(
    (key: string): void => {
      const { presence: current, entries: currentEntries } = latest.current;
      if (!current.leaving.some((leaving) => leaving.key === key && !leaving.isDone)) return;
      const next = finishLeaving(current, key);
      update(next);
      const patch = buildPatch(next, currentEntries);
      if (patch) commitSplit(path, patch);
    },
    [commitSplit, path, update],
  );

  // Before paint: the tiles are measured in the state of the old layout, and the animation starts in the same frame.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !presence.leaving.some((leaving) => leaving.mode === undefined)) return;
    update(planLeaving(presence, split.split, container));
  }, [containerRef, presence, split.split, update]);

  useEffect(() => {
    const container = containerRef.current;
    const planned = presence.leaving.filter((leaving) => leaving.mode !== undefined && !leaving.isDone);
    if (!container || planned.length === 0) return;
    const timer = setTimeout(() => planned.forEach((leaving) => finish(leaving.key)), fallbackDelay(container));
    return () => clearTimeout(timer);
  }, [containerRef, presence.leaving, finish]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLElement>): void => {
    const { target, currentTarget, propertyName } = event;
    if (propertyName !== "opacity" || !(target instanceof HTMLElement) || target.parentElement !== currentTarget)
      return;
    if (target.dataset.leaving !== undefined && target.dataset.tileId !== undefined)
      finish(idKey(target.dataset.tileId));
  };

  return { entries, handleTransitionEnd };
}

function planLeaving(presence: Presence, direction: SplitDirection, container: HTMLElement): Presence {
  const elements = tileElements(container);
  if (elements.length !== presence.children.length) return applyPlan(presence, { mode: "collapse", frozen: [] }, {});

  const plan = planRemoval(
    presence.children.map((child, i) => ({
      flex: tileFlex(child),
      isShare: typeof child.size !== "string",
      px: mainSize(elements[i], direction),
    })),
  );
  const leavingPx = Object.fromEntries(
    Array.from(container.querySelectorAll<HTMLElement>(":scope > .tessera-tile[data-leaving]")).flatMap(
      (element): [string, number][] =>
        element.dataset.tileId === undefined
          ? []
          : [[idKey(element.dataset.tileId), Math.round(mainSize(element, direction))]],
    ),
  );
  return applyPlan(presence, plan, leavingPx);
}

// 0 when the CSS has no transition (reduced motion, duration 0): the tile leaves at once.
function fallbackDelay(container: HTMLElement): number {
  const leaving = container.querySelector(":scope > .tessera-tile[data-leaving]");
  if (!leaving) return 0;
  const durations = getComputedStyle(leaving).transitionDuration.split(",").map(toMilliseconds);
  const longest = Math.max(0, ...durations);
  return longest === 0 ? 0 : longest + FALLBACK_MARGIN_MS;
}

function toMilliseconds(time: string): number {
  const value = parseFloat(time);
  if (Number.isNaN(value)) return 0;
  return time.trim().endsWith("ms") ? value : value * 1000;
}
