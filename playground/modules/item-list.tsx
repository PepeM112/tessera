interface ItemListProps {
  title: string;
  count?: number;
}

export function ItemList({ title, count = 30 }: ItemListProps) {
  const items = Array.from({ length: count }, (_, i) => `${title} item ${i + 1}`);

  return (
    <div className="demo-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
