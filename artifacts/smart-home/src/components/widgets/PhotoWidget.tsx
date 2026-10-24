import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import type { PhotoWidgetData } from "@/hooks/use-dashboard-layout";

interface PhotoWidgetProps {
  data: PhotoWidgetData;
  onChange?: (data: PhotoWidgetData) => void;
  readOnly?: boolean;
}

export function PhotoWidget({ data, onChange, readOnly = false }: PhotoWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const images = data.images ?? [];
  const interval = (data.interval ?? 5) * 1000;

  const nextImage = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isPlaying || images.length <= 1) return;
    const timer = setInterval(nextImage, interval);
    return () => clearInterval(timer);
  }, [isPlaying, interval, nextImage, images.length]);

  if (images.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 rounded-2xl bg-[#111113] border border-[#1f1f22]">
        <span className="text-3xl mb-2">🖼️</span>
        <span className="text-xs text-neutral-400">Нет фотографий</span>
        <span className="text-[10px] text-neutral-600 mt-1">Загрузите в настройках</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f1f22]">
        <span className="text-xs font-medium text-neutral-400">Фотоальбом</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            onClick={prevImage}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={nextImage}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 relative">
        <img
          src={images[currentIndex]}
          alt={`Фото ${currentIndex + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Dots */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-1 py-1.5">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                idx === currentIndex ? "bg-foreground" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
