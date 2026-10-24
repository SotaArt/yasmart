import { useState, useEffect, useRef } from "react";
import type { NoteWidgetData } from "@/hooks/use-dashboard-layout";

interface NoteWidgetProps {
  data: NoteWidgetData;
  onChange?: (data: NoteWidgetData) => void;
  readOnly?: boolean;
}

export function NoteWidget({ data, onChange, readOnly = false }: NoteWidgetProps) {
  const [text, setText] = useState(data.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(data.text);
  }, [data.text]);

  const handleChange = (value: string) => {
    setText(value);
    onChange?.({ ...data, text: value });
  };

  return (
    <div className="h-full flex flex-col p-4 rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="text-lg">📝</span>
        <span className="text-xs font-medium text-neutral-400">Заметка</span>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        readOnly={readOnly}
        placeholder="Напишите заметку..."
        className="flex-1 w-full bg-transparent border-none outline-none resize-none text-sm text-neutral-200 placeholder:text-neutral-600"
        style={{ color: data.color }}
      />
    </div>
  );
}
