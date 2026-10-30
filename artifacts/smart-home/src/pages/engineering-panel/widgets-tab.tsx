import { useMemo, useRef, useState } from "react";
import { Eye, EyeOff, ImagePlus, Settings2 } from "lucide-react";
import { useWidgetVisibility } from "@/hooks/use-widget-visibility";
import {
  WIDGET_META,
  type WidgetConfig,
  type WidgetType,
} from "@/hooks/use-dashboard-layout";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { WidgetRenderer, WidgetSettingsEditor } from "@/components/widgets";
import { sortRooms, type Room } from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface WidgetsTabProps {
  rooms: Room[];
}

const WIDGET_TYPES = Object.keys(WIDGET_META) as WidgetType[];

async function readCompressedImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const maxSize = 1200;
      let width = img.width;
      let height = img.height;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function WidgetsTab({ rooms }: WidgetsTabProps) {
  const {
    getWidget,
    isWidgetVisible,
    setWidgetVisible,
    setWidgetRoom,
    setWidgetConfig,
  } = useWidgetVisibility();
  const { getUploadedImages, addUploadedImage } = useDashboardLayout();
  const [editingType, setEditingType] = useState<WidgetType | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const sortedRooms = useMemo(() => sortRooms(rooms), [rooms]);
  const enabledCount = WIDGET_TYPES.filter((type) => isWidgetVisible(type)).length;
  const editingEntry = editingType ? getWidget(editingType) : null;

  const toggleVisible = (type: WidgetType) => {
    const entry = getWidget(type);
    const enabled = entry.visible && !!entry.roomId;
    if (!enabled) {
      if (!entry.roomId && sortedRooms[0]) {
        setWidgetRoom(type, sortedRooms[0].id);
      }
      setWidgetVisible(type, true);
    } else {
      setWidgetVisible(type, false);
    }
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!editingType || !editingEntry || !files || files.length === 0) return;
    try {
      const images = await Promise.all(Array.from(files).map(readCompressedImage));
      images.forEach((image) => addUploadedImage(image));
      const current = editingEntry.config.data as { images?: string[] };
      setWidgetConfig(editingType, {
        ...editingEntry.config,
        data: { ...current, images: [...(current.images ?? []), ...images] },
      });
      toast({ title: "Фото добавлены", description: `${images.length} изображ. добавлено в альбом` });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось загрузить изображения" });
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        {WIDGET_TYPES.length} виджетов доступно · {enabledCount} включено в ЮП
      </p>

      <div className="space-y-2">
        {WIDGET_TYPES.map((type) => {
          const entry = getWidget(type);
          const meta = WIDGET_META[type];
          const canEnable = sortedRooms.length > 0;
          const enabled = entry.visible && !!entry.roomId;

          return (
            <div
              key={type}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 bg-card border rounded-xl px-4 py-3 transition-colors ${
                enabled ? "border-border/50" : "border-border/30 opacity-70"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xl w-7 text-center flex-shrink-0">{meta.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {enabled ? "Показывается в юзер-панели" : "Скрыт"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <select
                  value={entry.roomId ?? ""}
                  onChange={(e) => setWidgetRoom(type, e.target.value || null)}
                  disabled={!enabled || sortedRooms.length === 0}
                  className="text-[11px] bg-muted/50 border border-border/50 rounded-md px-2 py-1.5 text-foreground cursor-pointer hover:bg-muted/80 transition-colors max-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Комната виджета"
                >
                  <option value="">Выберите комнату</option>
                  {sortedRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setEditingType(type)}
                  disabled={!enabled}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Настроить виджет"
                >
                  <Settings2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => toggleVisible(type)}
                  disabled={!canEnable && !enabled}
                  className={`p-1.5 rounded-md transition-colors ${
                    enabled
                      ? "text-primary hover:text-primary/80 hover:bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={
                    canEnable
                      ? enabled
                        ? "Скрыть из юзер-панели"
                        : "Показать в юзер-панели"
                      : "Сначала создайте комнату"
                  }
                >
                  {enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingType && editingEntry && (
        <Dialog open onOpenChange={(open) => { if (!open) setEditingType(null); }}>
          <DialogContent className="sm:max-w-md p-4">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-sm font-medium">
                {WIDGET_META[editingType].icon} {WIDGET_META[editingType].label}
              </DialogTitle>
            </DialogHeader>

            <div className="h-48 mb-4 rounded-lg overflow-hidden border border-border/50">
              <WidgetRenderer
                config={editingEntry.config}
                onChange={(config: WidgetConfig) => setWidgetConfig(editingType, config)}
              />
            </div>

            <WidgetSettingsEditor
              config={editingEntry.config}
              onChange={(config) => setWidgetConfig(editingType, config)}
              uploadedImages={getUploadedImages()}
            />

            {editingType === "photo" && (
              <div className="mt-3">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handlePhotoUpload(e.target.files)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full"
                >
                  <ImagePlus className="w-4 h-4 mr-1.5" />
                  Загрузить фотографии
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setEditingType(null)}>
                Закрыть
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
