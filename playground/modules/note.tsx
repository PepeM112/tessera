import { useId, useState, type ChangeEvent } from "react";

interface NoteProps {
  title: string;
}

// Local state: it stays during a resize and goes when a layout switch moves or removes the tile.
export function Note({ title }: NoteProps) {
  const id = useId();
  const [text, setText] = useState("");

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => setText(event.target.value);

  return (
    <div className="demo-note">
      <label htmlFor={id}>{title}</label>
      <textarea id={id} value={text} onChange={handleChange} />
    </div>
  );
}
