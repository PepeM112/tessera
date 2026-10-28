import { type ChangeEvent } from "react";

import { type Layout, type TileFlex } from "tessera";

import { canRemoveTile, flexOf, isTileShown, type CardInfo, type RemovedTile } from "./tile-tree";

interface CardControlsProps {
  cards: CardInfo[];
  layout: Layout;
  removed: RemovedTile[];
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
  onFlexChange: (id: string, flex: TileFlex) => void;
}

const FLEXES = ["grow", "static", "pack"] as const satisfies readonly TileFlex[];

export function CardControls({ cards, layout, removed, onRemove, onRestore, onFlexChange }: CardControlsProps) {
  return (
    <fieldset className="demo-controls demo-cards">
      <legend>Cards</legend>
      {cards.map(({ id, label }) => {
        const isShown = isTileShown(layout, id);
        const canRestore = removed.some((item) => item.tile.id === id);

        const handleShownChange = (event: ChangeEvent<HTMLInputElement>): void => {
          if (event.target.checked) onRestore(id);
          else onRemove(id);
        };

        const handleFlexChange = (event: ChangeEvent<HTMLSelectElement>): void => {
          const flex = FLEXES.find((item) => item === event.target.value);
          if (flex) onFlexChange(id, flex);
        };

        return (
          <div key={id} className="demo-card-row">
            <label>
              <input
                type="checkbox"
                checked={isShown}
                disabled={isShown ? !canRemoveTile(layout, id) : !canRestore}
                onChange={handleShownChange}
              />
              {label}
            </label>
            <select
              aria-label={`Flex of ${label}`}
              value={flexOf(layout, id)}
              disabled={!isShown}
              onChange={handleFlexChange}
            >
              {FLEXES.map((flex) => (
                <option key={flex} value={flex}>
                  {flex}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </fieldset>
  );
}
