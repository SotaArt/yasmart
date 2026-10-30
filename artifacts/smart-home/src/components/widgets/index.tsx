import type { WidgetConfig, WidgetType } from "@/hooks/use-dashboard-layout";
import { NoteWidget } from "./NoteWidget";
import { PhotoWidget } from "./PhotoWidget";
import { CalendarWidget, CalendarWidgetSettings } from "./CalendarWidget";
import { RecipesWidget, RecipesWidgetSettings } from "./RecipesWidget";
import { WeatherWidget } from "./WeatherWidget";
import { ShoppingListWidget } from "./ShoppingListWidget";
import { TasksWidget } from "./TasksWidget";
import { CountdownTimerWidget } from "./CountdownTimerWidget";
import { ExpensesWidget, ExpensesWidgetSettings } from "./ExpensesWidget";

interface WidgetRendererProps {
  config: WidgetConfig;
  onChange?: (config: WidgetConfig) => void;
  readOnly?: boolean;
}

export function WidgetRenderer({ config, onChange, readOnly }: WidgetRendererProps) {
  const handleChange = (data: any) => {
    onChange?.({ ...config, data });
  };

  switch (config.type) {
    case "note":
      return <NoteWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    case "photo":
      return <PhotoWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    case "calendar":
      return <CalendarWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    case "recipes":
      return <RecipesWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    case "weather":
      return <WeatherWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    case "shopping":
      return <ShoppingListWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    case "tasks":
      return <TasksWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    case "timer":
      return <CountdownTimerWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    case "expenses":
      return <ExpensesWidget data={config.data as any} onChange={handleChange} readOnly={readOnly} />;
    default:
      return (
        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
          Неизвестный тип виджета
        </div>
      );
  }
}

interface WidgetSettingsEditorProps {
  config: WidgetConfig;
  onChange: (config: WidgetConfig) => void;
  uploadedImages?: string[];
}

export function WidgetSettingsEditor({ config, onChange, uploadedImages = [] }: WidgetSettingsEditorProps) {
  const updateData = (data: any) => {
    onChange({ ...config, data });
  };

  switch (config.type) {
    case "note":
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Цвет текста</label>
            <input
              type="color"
              value={(config.data as any).color ?? "#D4A843"}
              onChange={(e) => updateData({ ...(config.data as any), color: e.target.value })}
              className="w-full h-8 rounded border border-border/50"
            />
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            Текст заметки редактируется прямо в превью выше.
          </p>
        </div>
      );
    case "photo":
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Интервал (сек)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={(config.data as any).interval ?? 5}
              onChange={(e) =>
                updateData({ ...(config.data as any), interval: parseInt(e.target.value) || 5 })
              }
              className="w-full px-2 py-1.5 rounded border border-border/50 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Фотографии</label>
            {uploadedImages.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/70">
                Загрузите изображения кнопкой «Загрузить фотографии» ниже.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-1 max-h-24 overflow-y-auto">
                {uploadedImages.map((img, idx) => {
                  const images = (config.data as any).images ?? [];
                  const isSelected = images.includes(img);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        const newImages = isSelected
                          ? images.filter((i: string) => i !== img)
                          : [...images, img];
                        updateData({ ...(config.data as any), images: newImages });
                      }}
                      className={`aspect-video rounded overflow-hidden border-2 ${
                        isSelected ? "border-primary" : "border-border/50 opacity-60"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    case "calendar":
      return <CalendarWidgetSettings data={config.data as any} onChange={updateData} />;
    case "recipes":
      return <RecipesWidgetSettings data={config.data as any} onChange={updateData} />;
    case "weather":
      return (
        <p className="text-[10px] text-muted-foreground/70">
          Погода определяется автоматически по городу. Дополнительных настроек нет.
        </p>
      );
    case "shopping":
    case "tasks":
      return (
        <p className="text-[10px] text-muted-foreground/70">
          Список редактируется прямо в виджете (в юзер-панели и в превью выше).
        </p>
      );
    case "timer":
      return (
        <p className="text-[10px] text-muted-foreground/70">
          Управление таймером доступно в юзер-панели.
        </p>
      );
    case "expenses":
      return <ExpensesWidgetSettings data={config.data as any} onChange={updateData} />;
    default:
      return null;
  }
}

export { NoteWidget } from "./NoteWidget";
export { PhotoWidget } from "./PhotoWidget";
export { CalendarWidget, CalendarWidgetSettings } from "./CalendarWidget";
export { RecipesWidget, RecipesWidgetSettings } from "./RecipesWidget";
export { WeatherWidget } from "./WeatherWidget";
export { ShoppingListWidget } from "./ShoppingListWidget";
export { TasksWidget } from "./TasksWidget";
export { CountdownTimerWidget } from "./CountdownTimerWidget";
export { ExpensesWidget, ExpensesWidgetSettings } from "./ExpensesWidget";
export type { WidgetType };