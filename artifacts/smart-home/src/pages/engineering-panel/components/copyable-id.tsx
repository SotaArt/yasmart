import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

export function CopyableId({ id, label = "ID" }: { id: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [id]);

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-1.5 py-0.5 rounded transition-colors"
      title={`${label}: ${id}`}
    >
      {copied ? <Check className="w-2.5 h-2.5 text-[hsl(var(--gold))]" /> : <Copy className="w-2.5 h-2.5" />}
      <span className="truncate max-w-[100px]">{id.slice(0, 12)}…</span>
    </button>
  );
}
