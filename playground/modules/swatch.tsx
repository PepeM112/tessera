interface SwatchProps {
  label: string;
  color: string;
}

export function Swatch({ label, color }: SwatchProps) {
  return (
    <div className="demo-swatch" style={{ background: color }}>
      {label}
    </div>
  );
}
