import { Fragment, memo, useMemo, type CSSProperties } from "react";

import { Divider } from "./divider";
import {
  childPath,
  hasWindows,
  isSpacerTile,
  isSplitTile,
  type ModuleTile,
  type SplitTile,
  type Tile,
  type TileAppearance,
  type WindowsTile,
} from "./layout";
import { ModuleContent } from "./module-view";
import { DEFAULT_RESIZABLE_MIN_SIZE, tileFlexStyle, type SplitDirection } from "./size";
import { toCssValue } from "./theme";
import { describeDivider, type LeavingMode } from "./tile-presence";
import { useSplitResize } from "./use-split-resize";
import { TileContext } from "./use-tile";
import { useTilePresence } from "./use-tile-presence";
import { WindowPager } from "./window-pager";
import { useWorkspaceContext } from "./workspace-context";

interface TileNodeProps {
  tile: Tile;
  path: string;
  /** The direction of the parent split. The root tile has none. */
  direction?: SplitDirection;
  isInResizableSplit: boolean;
  /** Set while the tile leaves. `"pending"`: the animation is not planned yet. */
  leaving?: "pending" | LeavingMode;
  isEntering?: boolean;
  isFrozen?: boolean;
}

type TileVariables = Record<`--tessera-tile-${string}`, string>;

interface PresenceAttributes {
  "data-leaving": string | undefined;
  "data-entering": string | undefined;
  "data-frozen": string | undefined;
}

interface TileViewProps<T extends Tile> {
  tile: T;
  path: string;
  style: CSSProperties;
  attributes: PresenceAttributes;
}

const COLLAPSED_STYLE: CSSProperties = { flex: "0 0 0" };

// Memoized: a resize changes only the tiles on the path to the resized split, so other tiles skip the render.
export const TileNode = memo(function TileNode({
  tile,
  path,
  direction,
  isInResizableSplit,
  leaving,
  isEntering,
  isFrozen,
}: TileNodeProps) {
  // A leaving tile has no minimum size, so it can shrink to 0.
  const minSize = leaving
    ? undefined
    : ((isSpacerTile(tile) ? undefined : tile.minSize) ??
      (isInResizableSplit ? DEFAULT_RESIZABLE_MIN_SIZE : undefined));
  const flexStyle =
    leaving === "collapse" ? COLLAPSED_STYLE : tileFlexStyle(direction ? tile.size : undefined, minSize, direction);
  const attributes: PresenceAttributes = {
    "data-leaving": leaving,
    "data-entering": isEntering ? "" : undefined,
    "data-frozen": isFrozen ? "" : undefined,
  };

  if (isSpacerTile(tile)) {
    return (
      <div
        className="tessera-tile tessera-spacer"
        aria-hidden="true"
        data-tile-id={tile.id}
        style={flexStyle}
        {...attributes}
      />
    );
  }

  const style: CSSProperties = { ...flexStyle, ...(tile.background ? { background: tile.background } : {}) };
  return isSplitTile(tile) ? (
    <SplitTileView tile={tile} path={path} style={style} attributes={attributes} />
  ) : (
    <ModuleTileView tile={tile} path={path} style={style} attributes={attributes} />
  );
});

function SplitTileView({ tile, path, style, attributes }: TileViewProps<SplitTile>) {
  const { dividerLabel } = useWorkspaceContext();
  const { containerRef, draggingIndex, handlePointerDown, handleKeyDown, handleDoubleClick } = useSplitResize(
    tile,
    path,
  );
  const { entries, handleTransitionEnd } = useTilePresence(tile, path, containerRef);
  const isResizable = tile.resizable === true;

  return (
    <div
      ref={containerRef}
      className="tessera-tile tessera-split"
      data-direction={tile.split}
      data-tile-id={tile.id}
      style={style}
      onTransitionEnd={handleTransitionEnd}
      {...attributes}
    >
      {entries.map((entry, position) => {
        const divider = position > 0 ? describeDivider(entries, position) : undefined;
        return (
          <Fragment key={entry.key}>
            {divider &&
              (isResizable && divider.resizableIndex !== null ? (
                <Divider
                  index={divider.resizableIndex}
                  direction={tile.split}
                  label={dividerLabel}
                  isDragging={draggingIndex === divider.resizableIndex}
                  isEntering={divider.isEntering}
                  onPointerDown={handlePointerDown}
                  onKeyDown={handleKeyDown}
                  onDoubleClick={handleDoubleClick}
                />
              ) : (
                <div
                  className="tessera-divider"
                  aria-hidden="true"
                  data-leaving={divider.isCollapsing ? "collapse" : undefined}
                  data-entering={divider.isEntering ? "" : undefined}
                />
              ))}
            <TileNode
              tile={entry.tile}
              path={childPath(path, entry.index)}
              direction={tile.split}
              isInResizableSplit={isResizable}
              leaving={entry.state === "leaving" ? (entry.mode ?? "pending") : undefined}
              isEntering={entry.state === "entering"}
              isFrozen={entry.isFrozen}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function ModuleTileView({ tile, path, style, attributes }: TileViewProps<ModuleTile | WindowsTile>) {
  const info = useMemo(() => ({ id: tile.id, path }), [tile.id, path]);
  const hasCustomBorder = tile.borderWidth !== undefined || tile.borderColor !== undefined;

  return (
    <div
      {...attributes}
      className="tessera-tile tessera-module"
      data-module={hasWindows(tile) ? undefined : tile.module}
      data-tile-id={tile.id}
      data-elevation={tile.elevation}
      data-border={hasCustomBorder ? "custom" : undefined}
      style={{ ...style, ...appearanceStyle(tile) }}
    >
      <TileContext value={info}>
        {hasWindows(tile) ? (
          <WindowPager windows={tile.windows} />
        ) : (
          <ModuleContent moduleId={tile.module} props={tile.props} />
        )}
      </TileContext>
    </div>
  );
}

// Local variables: the CSS falls back to the theme value when a tile does not set one.
function appearanceStyle({ radius, borderWidth, borderColor }: TileAppearance): TileVariables {
  return {
    ...(radius === undefined ? {} : { "--tessera-tile-radius": toCssValue(radius) }),
    ...(borderWidth === undefined ? {} : { "--tessera-tile-border-width": toCssValue(borderWidth) }),
    ...(borderColor === undefined ? {} : { "--tessera-tile-border-color": borderColor }),
  };
}
