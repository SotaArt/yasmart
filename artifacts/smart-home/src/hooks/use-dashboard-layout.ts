import { useState, useCallback, useEffect, useRef } from "react";
import { loadServerSetting, saveServerSetting, deleteServerSetting } from "@/lib/server-settings";

const SETTINGS_KEY = "dashboard_layout";
const LOCAL_KEY = "dashboard_layout_backup";

export interface DashboardCell {
  deviceId?: string;
  scenarioId?: string;
  widget?: WidgetConfig;
  spanCols?: number;
  spanRows?: number;
  hiddenParts?: string[];
}

export type WidgetType =
  | "note"
  | "photo"
  | "calendar"
  | "recipes"
  | "weather"
  | "shopping"
  | "tasks"
  | "timer"
  | "expenses";

export interface WidgetConfig {
  type: WidgetType;
  data:
    | NoteWidgetData
    | PhotoWidgetData
    | CalendarWidgetData
    | RecipesWidgetData
    | WeatherWidgetData
    | ShoppingListWidgetData
    | TasksWidgetData
    | CountdownTimerWidgetData
    | ExpensesWidgetData;
}

export interface NoteWidgetData {
  text: string;
  color?: string;
}

export interface PhotoWidgetData {
  images: string[];
  interval?: number;
  showLabels?: boolean;
}

export interface CalendarWidgetData {
  events: CalendarEvent[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  color?: string;
  reminder?: boolean;
}

export interface RecipeItem {
  id: string;
  name: string;
  ingredients: string[];
  steps: string[];
}

export interface RecipesWidgetData {
  recipes: RecipeItem[];
}

export interface WeatherWidgetData {
  label?: string;
}

export interface ShoppingListItem {
  id: string;
  text: string;
  done: boolean;
  doneAt?: number;
}

export interface ShoppingListWidgetData {
  items: ShoppingListItem[];
}

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  doneAt?: number;
}

export interface TasksWidgetData {
  tasks: TaskItem[];
}

export interface CountdownTimerWidgetData {
  label?: string;
  duration?: number;
  endAt?: number;
  pausedRemaining?: number;
}

export interface ExpenseEntry {
  id: string;
  date: string;
  category: string;
  amount: number;
}

export interface ExpensesWidgetData {
  entries: ExpenseEntry[];
}

export const WIDGET_DEFAULTS: Record<WidgetType, WidgetConfig> = {
  note: { type: "note", data: { text: "", color: "#D4A843" } },
  photo: { type: "photo", data: { images: [], interval: 5 } },
  calendar: { type: "calendar", data: { events: [] } },
  recipes: { type: "recipes", data: { recipes: [] } },
  weather: { type: "weather", data: {} },
  shopping: { type: "shopping", data: { items: [] } },
  tasks: { type: "tasks", data: { tasks: [] } },
  timer: { type: "timer", data: {} },
  expenses: { type: "expenses", data: { entries: [] } },
};

export const WIDGET_META: Record<WidgetType, { label: string; icon: string }> = {
  note: { label: "Заметка", icon: "📝" },
  photo: { label: "Фотоальбом", icon: "🖼️" },
  calendar: { label: "Календарь", icon: "📅" },
  recipes: { label: "Рецепты", icon: "🍳" },
  weather: { label: "Погода (расшир.)", icon: "⛅" },
  shopping: { label: "Список покупок", icon: "🛒" },
  tasks: { label: "Задачи", icon: "✅" },
  timer: { label: "Таймер", icon: "⏱️" },
  expenses: { label: "Расходы", icon: "💰" },
};

/** Сколько дней хранить выполненные записи/прошедшие события, прежде чем удалять их автоматически */
export const WIDGET_RETENTION_DAYS = 3;

const RETENTION_MS = WIDGET_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function cleanWidgetConfig(config: WidgetConfig): WidgetConfig {
  if (config.type === "shopping") {
    const data = config.data as ShoppingListWidgetData;
    const now = Date.now();
    return {
      ...config,
      data: {
        items: data.items.filter((i) => {
          if (i.done && i.doneAt != null) return now - i.doneAt < RETENTION_MS;
          return true;
        }),
      },
    };
  }
  if (config.type === "tasks") {
    const data = config.data as TasksWidgetData;
    const now = Date.now();
    return {
      ...config,
      data: {
        tasks: data.tasks.filter((t) => {
          if (t.done && t.doneAt != null) return now - t.doneAt < RETENTION_MS;
          return true;
        }),
      },
    };
  }
  if (config.type === "calendar") {
    const data = config.data as CalendarWidgetData;
    const cutoff = Date.now() - RETENTION_MS;
    return {
      ...config,
      data: {
        events: data.events.filter((e) => {
          const t = new Date(`${e.date}T00:00:00`).getTime();
          return Number.isNaN(t) || t >= cutoff;
        }),
      },
    };
  }
  return config;
}

/** Прочитать лейаут, убрать устаревшие записи из всех виджетов (cells + widgets store) */
export function cleanLayout(layout: DashboardLayout): DashboardLayout {
  const { rooms: rawRooms, ...rest } = layout;
  const rooms: Record<string, Record<string, DashboardCell>> = {};
  for (const [roomId, cells] of Object.entries(rawRooms ?? {})) {
    const nextCells: Record<string, DashboardCell> = {};
    for (const [key, cell] of Object.entries(cells)) {
      nextCells[key] = cell.widget ? { ...cell, widget: cleanWidgetConfig(cell.widget) } : cell;
    }
    rooms[roomId] = nextCells;
  }
  // Единое хранилище виджетов = ячейки; устаревшее отдельное поле widgets удаляется
  const cleaned: DashboardLayout = { ...rest, rooms };
  delete (cleaned as { widgets?: unknown }).widgets;
  return cleaned;
}

export interface DashboardLayout {
  rooms: Record<string, Record<string, DashboardCell>>;
  gridSize?: { cols: number; rows: number };
  roomGridSizes?: Record<string, { cols: number; rows: number }>;
  backgrounds: Record<string, string>;
  uploadedImages: string[];
  widgets?: Record<string, WidgetConfig>;
}

export const GRID_PRESETS = [
  { label: "2×3", cols: 2, rows: 3 },
  { label: "2×4", cols: 2, rows: 4 },
  { label: "3×3", cols: 3, rows: 3 },
  { label: "3×4", cols: 3, rows: 4 },
  { label: "4×3", cols: 4, rows: 3 },
  { label: "4×4", cols: 4, rows: 4 },
  { label: "5×3", cols: 5, rows: 3 },
  { label: "5×4", cols: 5, rows: 4 },
  { label: "6×3", cols: 6, rows: 3 },
  { label: "6×4", cols: 6, rows: 4 },
  { label: "7×3", cols: 7, rows: 3 },
  { label: "7×4", cols: 7, rows: 4 },
  { label: "8×3", cols: 8, rows: 3 },
  { label: "8×4", cols: 8, rows: 4 },
  { label: "9×3", cols: 9, rows: 3 },
  { label: "9×4", cols: 9, rows: 4 },
] as const;

export const DEFAULT_GRID_SIZE = { cols: 4, rows: 3 };

const DEFAULT_LAYOUT: DashboardLayout = { rooms: {}, backgrounds: {}, uploadedImages: [] };

function hasContent(layout: DashboardLayout | null): boolean {
  if (!layout) return false;
  return (
    !!layout.gridSize ||
    Object.keys(layout.roomGridSizes ?? {}).length > 0 ||
    Object.keys(layout.rooms ?? {}).length > 0 ||
    Object.keys(layout.backgrounds ?? {}).length > 0 ||
    (layout.uploadedImages ?? []).length > 0
  );
}

function loadBackup(): DashboardLayout | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!hasContent(parsed)) return null;
    return { ...DEFAULT_LAYOUT, ...parsed };
  } catch {
    return null;
  }
}

function saveBackup(layout: DashboardLayout): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(layout));
  } catch {}
}

function clearBackup(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {}
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isLoaded, setIsLoaded] = useState(false);
  const skipSaveRef = useRef(false);

  // Загрузка: приоритет сервер → localStorage-зеркало → дефолт
  useEffect(() => {
    loadServerSetting<DashboardLayout>(SETTINGS_KEY).then(serverData => {
      const raw: DashboardLayout = (hasContent(serverData) ? { ...DEFAULT_LAYOUT, ...serverData } : null)
        ?? loadBackup()
        ?? DEFAULT_LAYOUT;
      const data = cleanLayout(raw);
      skipSaveRef.current = true;
      setLayout(data);
      setIsLoaded(true);
      if (JSON.stringify(data) !== JSON.stringify(raw)) {
        saveBackup(data);
        if (hasContent(data)) {
          saveServerSetting(SETTINGS_KEY, data);
        }
      }
    });
  }, []);

  // Сохранение: локальное зеркало сразу, сервер с дебаунсом
  useEffect(() => {
    if (!isLoaded || skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const data = cleanLayout(layout);
    saveBackup(data);
    const timeoutId = setTimeout(() => {
      saveServerSetting(SETTINGS_KEY, data);
      window.dispatchEvent(new Event("dashboard-layout-changed"));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [layout, isLoaded]);

  /** Немедленно сохранить текущий лейаут (кнопка «Сохранить») */
  const saveLayout = useCallback(async (): Promise<boolean> => {
    const data = cleanLayout(layout);
    saveBackup(data);
    const ok = await saveServerSetting(SETTINGS_KEY, data);
    window.dispatchEvent(new Event("dashboard-layout-changed"));
    return ok;
  }, [layout]);

  /** Сбросить лейаут к пустому и удалить с сервера (кнопка «Сбросить») */
  const resetLayout = useCallback(async (): Promise<void> => {
    skipSaveRef.current = true;
    clearBackup();
    setLayout(DEFAULT_LAYOUT);
    await deleteServerSetting(SETTINGS_KEY);
    window.dispatchEvent(new Event("dashboard-layout-changed"));
  }, []);

  /** Получить ячейки для комнаты */
  const getRoomCells = useCallback(
    (roomId: string): Record<string, DashboardCell> => layout.rooms[roomId] ?? {},
    [layout.rooms]
  );

  /** Установить ячейку */
  const setCell = useCallback((roomId: string, col: number, row: number, cell: DashboardCell) => {
    const key = `${col},${row}`;
    setLayout(prev => ({
      ...prev,
      rooms: {
        ...prev.rooms,
        [roomId]: {
          ...(prev.rooms[roomId] ?? {}),
          [key]: cell,
        },
      },
    }));
  }, []);

  /** Очистить ячейку */
  const clearCell = useCallback((roomId: string, col: number, row: number) => {
    const key = `${col},${row}`;
    setLayout(prev => {
      const next = { ...prev };
      if (next.rooms[roomId]) {
        next.rooms = { ...next.rooms };
        next.rooms[roomId] = { ...next.rooms[roomId] };
        delete next.rooms[roomId][key];
      }
      return next;
    });
  }, []);

  /** Очистить всю комнату */
  const clearRoom = useCallback((roomId: string) => {
    setLayout(prev => {
      const next = { ...prev };
      next.rooms = { ...next.rooms };
      delete next.rooms[roomId];
      return next;
    });
  }, []);

  /** Получить размер сетки. Если задан комнатный — возвращает его, иначе глобальный/дефолт */
  const getGridSize = useCallback(
    (roomId?: string): { cols: number; rows: number } => {
      if (roomId && layout.roomGridSizes?.[roomId]) {
        return layout.roomGridSizes[roomId];
      }
      return layout.gridSize ?? DEFAULT_GRID_SIZE;
    },
    [layout.gridSize, layout.roomGridSizes]
  );

  /** Установить размер сетки. Если передан roomId — сохраняет размер для конкретной комнаты */
  const setGridSize = useCallback((cols: number, rows: number, roomId?: string) => {
    setLayout(prev => {
      const next = { ...prev };
      if (roomId) {
        next.roomGridSizes = { ...(prev.roomGridSizes ?? {}), [roomId]: { cols, rows } };
      } else {
        next.gridSize = { cols, rows };
      }

      // Крупные ячейки, выпадающие за границы нового размера сетки, очищаются
      next.rooms = { ...next.rooms };
      const roomIds = roomId
        ? [roomId]
        : Object.keys(next.rooms).filter(id => !(next.roomGridSizes?.[id]));
      for (const roomIdKey of roomIds) {
        const roomCells = { ...next.rooms[roomIdKey] };
        let changed = false;
        for (const [key, cell] of Object.entries(roomCells)) {
          const [c, r] = key.split(",").map(Number);
          if (c >= cols || r >= rows) {
            delete roomCells[key];
            changed = true;
            continue;
          }
          const maxSpanCols = cols - c;
          const maxSpanRows = rows - r;
          let newCell = { ...cell };
          if (cell.spanCols && cell.spanCols > maxSpanCols) {
            newCell.spanCols = maxSpanCols;
            changed = true;
          }
          if (cell.spanRows && cell.spanRows > maxSpanRows) {
            newCell.spanRows = maxSpanRows;
            changed = true;
          }
          if (changed) roomCells[key] = newCell;
        }
        if (changed) next.rooms[roomIdKey] = roomCells;
      }
      return next;
    });
  }, []);

  /** Сбросить комнатный размер сетки — комната снова использует глобальный/дефолт */
  const resetRoomGridSize = useCallback((roomId: string) => {
    setLayout(prev => {
      if (!prev.roomGridSizes?.[roomId]) return prev;
      const roomGridSizes = { ...prev.roomGridSizes };
      delete roomGridSizes[roomId];
      return { ...prev, roomGridSizes };
    });
  }, []);

  /** Получить фон комнаты */
  const getRoomBackground = useCallback(
    (roomId: string): string | null => layout.backgrounds[roomId] ?? null,
    [layout.backgrounds]
  );

  /** Установить фон комнаты */
  const setRoomBackground = useCallback((roomId: string, imageData: string | null) => {
    setLayout(prev => {
      const next = { ...prev };
      next.backgrounds = { ...prev.backgrounds };
      if (imageData) {
        next.backgrounds[roomId] = imageData;
      } else {
        delete next.backgrounds[roomId];
      }
      return next;
    });
  }, []);

  /** Получить загруженные изображения */
  const getUploadedImages = useCallback(
    (): string[] => layout.uploadedImages ?? [],
    [layout.uploadedImages]
  );

  /** Добавить изображение */
  const addUploadedImage = useCallback((imageData: string) => {
    setLayout(prev => ({
      ...prev,
      uploadedImages: [...(prev.uploadedImages ?? []), imageData],
    }));
  }, []);

  /** Удалить изображение */
  const removeUploadedImage = useCallback((index: number) => {
    setLayout(prev => {
      const next = { ...prev };
      next.uploadedImages = [...(prev.uploadedImages ?? [])];
      next.uploadedImages.splice(index, 1);
      return next;
    });
  }, []);

  return {
    getRoomCells, setCell, clearCell, clearRoom,
    getGridSize, setGridSize, resetRoomGridSize,
    getRoomBackground, setRoomBackground,
    getUploadedImages, addUploadedImage, removeUploadedImage,
    saveLayout, resetLayout,
    isLoaded,
  };
}
