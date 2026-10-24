import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FitContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Заполняет родителя на 100% и масштабирует содержимое, чтобы оно целиком
 * помещалось в доступную область (только вниз, без увеличения).
 *
 * Видимый слой занимает весь слот (100% высоты), поэтому содержимое карточки
 * может распределяться flex-колонкой: заголовок сверху, контент по центру,
 * таймер снизу. Если контент не помещается — невидимый замер находит
 * натуральную высоту и слой аккуратно сжимается.
 */
export function FitContent({ children, className }: FitContentProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;

    const compute = () => {
      const aw = box.clientWidth;
      const ah = box.clientHeight;
      const cw = measure.offsetWidth;
      const ch = measure.offsetHeight;
      if (aw <= 0 || ah <= 0 || cw <= 0 || ch <= 0) return;
      const s = Math.min(1, aw / cw, ah / ch);
      setScale((prev) => (Math.abs(prev - s) > 0.001 ? s : prev));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(box);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={boxRef} className={cn("relative w-full h-full overflow-hidden", className)}>
      {/* Невидимый замер: натуральный размер контента */}
      <div ref={measureRef} aria-hidden className="invisible absolute left-0 top-0 w-full pointer-events-none">
        {children}
      </div>
      {/* Видимый слой: занимает весь слот, распределение выполняет сама карточка */}
      <div
        className="w-full h-full"
        style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "center" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}