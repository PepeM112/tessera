import { use, type CSSProperties } from "react";

import { useTile } from "tessera";

import { TileActionsContext } from "../tile-actions";

interface CardProps {
  title: string;
  words: string;
  accent?: string;
}

// The × button removes the tile of this card through the app, like the checkbox in the side panel.
export function Card({ title, words, accent = "#4f7cff" }: CardProps) {
  const { id } = useTile();
  const { removeTile } = use(TileActionsContext);

  const handleRemove = (): void => {
    if (id) removeTile(id);
  };

  // SAFETY: CSSProperties has no index signature for custom properties.
  const style = { "--demo-accent": accent } as CSSProperties;

  return (
    <article className="demo-card" style={style}>
      <header>
        <h2>{title}</h2>
        <button type="button" className="demo-card-remove" aria-label={`Remove ${title}`} onClick={handleRemove}>
          ×
        </button>
      </header>
      <p>{words}</p>
    </article>
  );
}
