import { Fragment, memo, type ComponentType, type CSSProperties } from "react";

import { Divider } from "./divider";
import { childPath, isSplitTile, type ModuleProps, type ModuleTile, type SplitTile, type Tile } from "./layout";
import { DEFAULT_RESIZABLE_MIN_SIZE, tileFlexStyle, type SplitDirection } from "./size";
import { useSplitResize } from "./use-split-resize";
import { useWorkspaceContext } from "./workspace-context";

interface TileNodeProps {
  tile: Tile;
  path: string;
  /** The direction of the parent split. The root tile has none. */
  direction?: SplitDirection;
  isInResizableSplit: boolean;
}

interface TileViewProps<T extends Tile> {
  tile: T;
  path: string;
  style: CSSProperties;
}

interface ModuleViewProps {
  component: ComponentType<never>;
  props: ModuleProps | undefined;
}

// Memoized: a resize changes only the tiles on the path to the resized split, so other tiles skip the render.
export const TileNode = memo(function TileNode({ tile, path, direction, isInResizableSplit }: TileNodeProps) {
  const minSize = tile.minSize ?? (isInResizableSplit ? DEFAULT_RESIZABLE_MIN_SIZE : undefined);
  const style: CSSProperties = {
    ...tileFlexStyle(direction ? tile.size : undefined, minSize, direction),
    ...(tile.background ? { background: tile.background } : {}),
  };

  return isSplitTile(tile) ? (
    <SplitTileView tile={tile} path={path} style={style} />
  ) : (
    <ModuleTileView tile={tile} path={path} style={style} />
  );
});

function SplitTileView({ tile, path, style }: TileViewProps<SplitTile>) {
  const { dividerLabel } = useWorkspaceContext();
  const { containerRef, draggingIndex, handlePointerDown, handleKeyDown, handleDoubleClick } = useSplitResize(
    tile,
    path,
  );
  const isResizable = tile.resizable === true;

  return (
    <div
      ref={containerRef}
      className="tessera-tile tessera-split"
      data-direction={tile.split}
      data-tile-id={tile.id}
      style={style}
    >
      {tile.children.map((child, i) => (
        <Fragment key={i}>
          {i > 0 &&
            (isResizable ? (
              <Divider
                index={i - 1}
                direction={tile.split}
                label={dividerLabel}
                isDragging={draggingIndex === i - 1}
                onPointerDown={handlePointerDown}
                onKeyDown={handleKeyDown}
                onDoubleClick={handleDoubleClick}
              />
            ) : (
              <div className="tessera-divider" aria-hidden="true" />
            ))}
          <TileNode tile={child} path={childPath(path, i)} direction={tile.split} isInResizableSplit={isResizable} />
        </Fragment>
      ))}
    </div>
  );
}

function ModuleTileView({ tile, style }: TileViewProps<ModuleTile>) {
  const { modules, renderUnknown } = useWorkspaceContext();
  // hasOwn: a module id like "toString" must not find a method of Object.prototype.
  const component = Object.hasOwn(modules, tile.module) ? modules[tile.module] : undefined;

  return (
    <div className="tessera-tile tessera-module" data-module={tile.module} data-tile-id={tile.id} style={style}>
      {component ? <ModuleView component={component} props={tile.props} /> : renderUnknown(tile.module)}
    </div>
  );
}

// Memoized on the component and the props object, so a resize does not render the module again.
const ModuleView = memo(function ModuleView({ component, props }: ModuleViewProps) {
  // SAFETY: a layout's props are the module's props by contract. defineLayout checks them in TS layouts.
  const Module = component as ComponentType<ModuleProps>;
  return <Module {...props} />;
});
