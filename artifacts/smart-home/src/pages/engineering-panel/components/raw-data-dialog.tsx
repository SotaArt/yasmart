import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";

interface RawDataDialogProps {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RawExportData {
  exportedAt?: string;
  userInfo?: { devices?: unknown[] };
  [key: string]: unknown;
}

export function RawDataDialog({ token, open, onOpenChange }: RawDataDialogProps) {
  const [data, setData] = useState<RawExportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    fetch("/api/yandex/raw-export", {
      headers: { "x-yandex-token": token },
    })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const err = JSON.parse(text);
            msg = err.error || msg;
          } catch {}
          throw new Error(msg);
        }
        return JSON.parse(text) as RawExportData;
      })
      .then((json) => setData(json))
      .catch((err: Error) => setError(err.message || "Не удалось получить данные"))
      .finally(() => setLoading(false));
  }, [open, token]);

  useEffect(() => {
    if (!open) {
      fetchedRef.current = false;
      setData(null);
      setCopied(false);
    }
  }, [open]);

  const rawText = data ? JSON.stringify(data, null, 2) : "";
  const deviceCount = data?.userInfo?.devices?.length ?? 0;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      toast({ variant: "success", title: "Скопировано", description: "Сырые данные всех устройств в буфере обмена" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка копирования",
        description: err?.message || "Не удалось скопировать",
      });
    }
  }, [rawText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Сырые данные по оборудованию
            {data && !loading && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {deviceCount} устройств
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!data || loading}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Скопировано" : "Скопировать всё"}
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border/50 bg-muted/40 p-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/6" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Ошибка: {error}</p>
          ) : data ? (
            <pre className="text-[11px] font-mono leading-relaxed whitespace-pre">{rawText}</pre>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}