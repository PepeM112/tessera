import { useEffect, useRef, useState } from "react";

interface SizeReadoutProps {
  label: string;
}

interface Size {
  width: number;
  height: number;
}

// Shows the tile size in px, so the layout units can be checked by eye.
export function SizeReadout({ label }: SizeReadoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="demo-readout">
      <strong>{label}</strong>
      <span className="demo-muted">{size ? `${size.width} × ${size.height}` : "…"}</span>
    </div>
  );
}
