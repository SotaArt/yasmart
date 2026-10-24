import { useState, useMemo, useRef } from "react";
import { useDashboardLayout, GRID_PRESETS, WIDGET_DEFAULTS, WIDGET_META, type WidgetType, type WidgetConfig } from "@/hooks/use-dashboard-layout";
import { useRoomVisibility } from "@/hooks/use-room-visibility";
import { useDeviceVisibility } from "@/hooks/use-device-visibility";
import { useSensorDevices } from "@/hooks/use-sensor-devices";
import { useScenarioVisibility } from "@/hooks/use-scenario-visibility";
import { WidgetRenderer, WidgetSettingsEditor } from "@/components/widgets";
import { toast } from "@/hooks/use-toast";
import type { Device, Room } from "@/lib/yandex";
import { matchDeviceToTemplate } from "@/lib/device-template-map";
import { DeviceGridCard } from "@/components/smart-card/DeviceGridCard";
import { getSupportedCardParts, CARD_PART_META, type CardPartId } from "@/components/smart-card/card-parts";
import { Eye, EyeOff, X, ArrowRight, ArrowDown, Zap, Grid3X3, Upload, Image, Trash2, Save, RotateCcw } from "lucide-react";
import { ROOM_PRIORITY } from "@/lib/yandex";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LayoutTabProps {
  rooms: Room[];
  devices: Device[];
  scenarios: { id: string; name: string }[];
  token: string;
}

export function LayoutTab({ rooms, devices, scenarios, token }: LayoutTabProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [editingWidget, setEditingWidget] = useState<{ cellKey: string; config: WidgetConfig } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    getRoomCells, setCell, clearCell, clearRoom,
    getGridSize, setGridSize, resetRoomGridSize,
    getRoomBackground, setRoomBackground,
    getUploadedImages, addUploadedImage, removeUploadedImage,
    saveLayout, resetLayout,
  } = useDashboardLayout();
  const { isRoomVisible } = useRoomVisibility();
  const { isDeviceVisible } = useDeviceVisibility();
  const { isSensorOnly } = useSensorDevices();
  const { isScenarioVisible, isScenarioInRoom } = useScenarioVisibility();

  const uploadedImages = getUploadedImages();

  // Sorted visible rooms (same order as ЮП)
  const visibleRooms = useMemo(
    () =>
      rooms
        .filter((r) => isRoomVisible(r.id))
        .sort((a, b) => {
          const pa = ROOM_PRIORITY[a.name.toLowerCase()] ?? 99;
          const pb = ROOM_PRIORITY[b.name.toLowerCase()] ?? 99;
          return pa - pb;
        }),
    [rooms, isRoomVisible]
  );

  const activeRoomId = selectedRoomId ?? visibleRooms[0]?.id ?? null;
  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const activeRoomBackground = activeRoomId ? getRoomBackground(activeRoomId) : null;

  const gridSize = getGridSize(activeRoomId ?? undefined);

  // Devices available for this room: visible (eye on), not sensor-only, not sensor type, in this room
  const roomDevices = useMemo(() => {
    if (!activeRoomId) return [];
    const roomDeviceIds = new Set(activeRoom?.devices ?? []);
    return devices.filter(
      (d) =>
        isDeviceVisible(d.id) &&
        !isSensorOnly(d.id) &&
        matchDeviceToTemplate(d)?.startsWith("sensor-") === false &&
        (d.room_id === activeRoomId || roomDeviceIds.has(d.id))
    );
  }, [activeRoomId, activeRoom, devices, isDeviceVisible, isSensorOnly]);

  // Sensors available for this room: visible, sensor type or marked as sensor-only
  const roomSensors = useMemo(() => {
    if (!activeRoomId) return [];
    const roomDeviceIds = new Set(activeRoom?.devices ?? []);
    return devices.filter(
      (d) =>
        isDeviceVisible(d.id) &&
        (d.room_id === activeRoomId || roomDeviceIds.has(d.id)) &&
        (isSensorOnly(d.id) || matchDeviceToTemplate(d)?.startsWith("sensor-") === true)
    );
  }, [activeRoomId, activeRoom, devices, isDeviceVisible, isSensorOnly]);

  // Scenarios available for this room: visible and assigned to this room
  const roomScenarios = useMemo(() => {
    if (!activeRoomId) return [];
    return scenarios.filter((sc) => {
      if (!isScenarioVisible(sc.id)) return false;
      return isScenarioInRoom(sc.id, activeRoomId);
    });
  }, [scenarios, activeRoomId, isScenarioVisible, isScenarioInRoom]);

  const cells = activeRoomId ? getRoomCells(activeRoomId) : {};

  // Set of device/scenario IDs already assigned in this room
  const assignedIds = useMemo(() => {
    const deviceIds = new Set<string>();
    const scenarioIds = new Set<string>();
    for (const cell of Object.values(cells)) {
      if (cell.deviceId) deviceIds.add(cell.deviceId);
      if (cell.scenarioId) scenarioIds.add(cell.scenarioId);
    }
    return { devices: deviceIds, scenarios: scenarioIds };
  }, [cells]);

  if (visibleRooms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Нет видимых комнат в юзер-панели
      </p>
    );
  }

  const handleSave = async () => {
    const ok = await saveLayout();
    if (ok) {
      toast({ title: "Сохранено", description: "Сетка и изображения комнат сохранены на сервер" });
    } else {
      toast({ title: "Ошибка сохранения", description: "Не удалось сохранить на сервер", variant: "destructive" });
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Сбросить сетку, фоны и загруженные изображения к пустому состоянию? Это действие необратимо.")) {
      return;
    }
    await resetLayout();
    toast({ title: "Сброшено", description: "Настройки сетки и изображений очищены" });
  };

  return (
    <div className="space-y-4">
      {/* Сохранение / сброс */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Изменения сохраняются автоматически, но вы можете закрепить их на сервере вручную — это переживает очистку кэша.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Save className="w-3.5 h-3.5" />
            Сохранить
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить
          </button>
        </div>
      </div>

      {/* Room selector */}
      <div className="flex gap-2 flex-wrap">
        {visibleRooms.map((room) => {
          const roomCells = getRoomCells(room.id);
          const roomGrid = getGridSize(room.id);
          const roomCellCount = Object.values(roomCells).filter((c) => c.deviceId || c.scenarioId).length;
          return (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeRoomId === room.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {room.name}
              {roomCellCount > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">{roomCellCount}/{roomGrid.cols * roomGrid.rows}</span>
              )}
            </button>
          );
        })}
        {activeRoomId && (
          <button
            onClick={() => clearRoom(activeRoomId)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            Очистить
          </button>
        )}
      </div>

      {/* Grid size selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Grid3X3 className="w-4 h-4" />
          <span>Размер сетки{activeRoomId ? ` (${activeRoom?.name ?? ""})` : ""}:</span>
        </div>
        {GRID_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setGridSize(preset.cols, preset.rows, activeRoomId ?? undefined)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              gridSize.cols === preset.cols && gridSize.rows === preset.rows
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {preset.label}
          </button>
        ))}
        {activeRoomId && (
          <button
            onClick={() => resetRoomGridSize(activeRoomId)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted transition-colors"
            title="Вернуть общий размер сетки для этой комнаты"
          >
            <RotateCcw className="w-3 h-3" />
            Сбросить размер комнаты
          </button>
        )}
      </div>

      {/* Grid */}
      {activeRoomId && (
        <>
          <p className="text-xs text-muted-foreground">
            {roomDevices.length} устройств · {roomSensors.length} датчиков · {roomScenarios.length} сценариев доступно · {assignedIds.devices.size + assignedIds.scenarios.size} назначено
          </p>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${gridSize.cols}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize.rows}, minmax(100px, 1fr))`,
            }}
          >
            {(() => {
              // Track cells occupied by spans from other cells
              const occupiedBySpan = new Set<string>();

              return Array.from({ length: gridSize.rows }).map((_, row) =>
                Array.from({ length: gridSize.cols }).map((_, col) => {
                  const key = `${col},${row}`;

                  // Skip if this cell is occupied by a span from another cell
                  if (occupiedBySpan.has(key)) return null;

                  const cell = cells[key];
                  const device = cell?.deviceId
                    ? devices.find((d) => d.id === cell.deviceId)
                    : null;

                  const spanCols = cell?.spanCols ?? 1;
                  const spanRows = cell?.spanRows ?? 1;

                  // Mark cells covered by this span
                  if (spanCols > 1 || spanRows > 1) {
                    for (let dc = 0; dc < spanCols; dc++) {
                      for (let dr = 0; dr < spanRows; dr++) {
                        if (dc === 0 && dr === 0) continue;
                        const sk = `${col + dc},${row + dr}`;
                        if (col + dc < gridSize.cols && row + dr < gridSize.rows) {
                          occupiedBySpan.add(sk);
                        }
                      }
                    }
                  }

                  // Devices available for THIS cell: room devices minus already assigned
                  const cellAvailableDevices = roomDevices.filter((d) => !assignedIds.devices.has(d.id) || d.id === cell?.deviceId);
                  // Sensors available for THIS cell: room sensors minus already assigned
                  const cellAvailableSensors = roomSensors.filter((d) => !assignedIds.devices.has(d.id) || d.id === cell?.deviceId);
                  // Scenarios available for THIS cell: room scenarios minus already assigned
                  const cellAvailableScenarios = roomScenarios.filter((sc) => !assignedIds.scenarios.has(sc.id) || sc.id === cell?.scenarioId);

                  const onUpdate = (roomId: string, c: number, r: number, patch: any) => {
                    const existing = cells[`${c},${r}`] ?? {};
                    setCell(roomId, c, r, { ...existing, ...patch });
                  };

                  const isAc = device ? matchDeviceToTemplate(device) === "ac" : false;

                  const supportedParts = device ? getSupportedCardParts(device) : [];

                  const togglePart = (c: number, r: number, part: CardPartId) => {
                    const existing = cells[`${c},${r}`]?.hiddenParts ?? [];
                    const next = existing.includes(part)
                      ? existing.filter((p) => p !== part)
                      : [...existing, part];
                    onUpdate(activeRoomId, c, r, { hiddenParts: next.length ? next : undefined });
                  };

                  const previewSize = spanCols >= 2 && spanRows >= 2 ? "full" : spanCols > 1 || spanRows > 1 ? "expanded" : "standard";

                  const handleSpanChange = (axis: "cols" | "rows", delta: number) => {
                    if (!cell) return;
                    const current = axis === "cols" ? spanCols : spanRows;
                    const max = axis === "cols" ? gridSize.cols - col : gridSize.rows - row;
                    let next = Math.max(1, Math.min(max, current + delta));
                    if (isAc) {
                      // Кондиционер занимает 1 слот по горизонтали, по вертикали — минимум 2
                      if (axis === "cols") next = 1;
                      else next = Math.max(2, Math.min(max, next));
                    }
                    // Отклонить расширение, если под новые ячейки заняты другой карточкой
                    if (next > current) {
                      const newCols = axis === "cols" ? next : spanCols;
                      const newRows = axis === "rows" ? next : spanRows;
                      for (let dc = 0; dc < newCols; dc++) {
                        for (let dr = 0; dr < newRows; dr++) {
                          if (dc < spanCols && dr < spanRows) continue; // уже покрыто этой карточкой
                          const c = col + dc;
                          const r = row + dr;
                          if (c >= gridSize.cols || r >= gridSize.rows) continue;
                          const target = cells[`${c},${r}`];
                          if (
                            (target && (target.deviceId || target.scenarioId || target.widget)) ||
                            occupiedBySpan.has(`${c},${r}`)
                          ) {
                            return;
                          }
                        }
                      }
                    }
                    onUpdate(activeRoomId, col, row, {
                      [axis === "cols" ? "spanCols" : "spanRows"]: next === 1 ? undefined : next,
                    });
                  };

                  return (
                    <div
                      key={key}
                      className="relative border border-border/50 rounded-lg bg-card/50 flex flex-col"
                      style={{
                        gridColumn: `span ${spanCols}`,
                        gridRow: `span ${spanRows}`,
                      }}
                    >
                      {/* Cell header */}
                      <div className="flex items-center justify-between px-2 py-1 border-b border-border/30">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {col},{row}
                          {(spanCols > 1 || spanRows > 1) && (
                            <span className="ml-1 text-primary">
                              {spanCols}x{spanRows}
                            </span>
                          )}
                        </span>
                        {cell && (
                          <div className="flex items-center gap-1">
                            {/* Span controls */}
                            {!isAc && spanCols < gridSize.cols - col && (
                              <button
                                onClick={() => handleSpanChange("cols", 1)}
                                className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
                                title="Растянуть вправо"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            {spanRows < gridSize.rows - row && (
                              <button
                                onClick={() => handleSpanChange("rows", 1)}
                                className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
                                title="Растянуть вниз"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                            {(spanCols > 1 || spanRows > 1) && (
                              <button
                                onClick={() => handleSpanChange(isAc ? "rows" : "cols", -1)}
                                className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                                title="Уменьшить"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                            {cell?.widget && (
                              <button
                                onClick={() => setEditingWidget({ cellKey: key, config: cell.widget! })}
                                className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
                                title="Редактировать виджет"
                              >
                                <span className="text-[10px]">{WIDGET_META[cell.widget.type]?.icon}</span>
                              </button>
                            )}
                            <button
                              onClick={() => clearCell(activeRoomId, col, row)}
                              className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Device/scenario/widget display or dropdown */}
                      {device ? (
                        <>
                          {supportedParts.length > 0 && (
                            <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border/20 flex-wrap">
                              <span className="text-[9px] text-muted-foreground mr-0.5">Части:</span>
                              {supportedParts.map((part) => {
                                const hidden = cell?.hiddenParts?.includes(part);
                                return (
                                  <button
                                    key={part}
                                    onClick={() => togglePart(col, row, part)}
                                    title={`${CARD_PART_META[part].label} — ${hidden ? "показать" : "скрыть"}`}
                                    className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] transition-colors ${
                                      hidden
                                        ? "text-destructive/80 hover:text-destructive"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    <span className={hidden ? "line-through" : ""}>
                                      {CARD_PART_META[part].label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex-1 min-h-0 pointer-events-none select-none">
                            <DeviceGridCard
                              device={device}
                              token={token}
                              size={previewSize}
                              hiddenParts={(cell?.hiddenParts ?? []) as any}
                            />
                          </div>
                          {isAc && spanRows < 2 && (
                            <p className="text-[9px] text-amber-500/90 w-full text-center leading-tight bg-card/60 border-t border-border/20 px-1 py-0.5">
                              ⚠️ Кондиционер — вертикальная карточка (1 колонка), увеличьте по ↓, минимум 1×2
                            </p>
                          )}
                        </>
                      ) : cell?.scenarioId ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-2 gap-1">
                          <span className="text-2xl"><Zap className="w-6 h-6 text-yellow-500" /></span>
                          <p className="text-[10px] font-medium text-foreground truncate w-full text-center">
                            {scenarios.find((sc) => sc.id === cell.scenarioId)?.name ?? "Сценарий"}
                          </p>
                        </div>
                      ) : cell?.widget ? (
                        <div className="flex-1 min-h-0">
                          <WidgetRenderer config={cell.widget} readOnly />
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-2 gap-1.5">
                          {/* Устройства */}
                          {cellAvailableDevices.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const placed = devices.find((d) => d.id === val);
                                if (placed && matchDeviceToTemplate(placed) === "ac") {
                                  setCell(activeRoomId, col, row, {
                                    deviceId: val,
                                    spanCols: 1,
                                    spanRows: Math.max(1, Math.min(2, gridSize.rows - row)),
                                  });
                                } else {
                                  setCell(activeRoomId, col, row, { deviceId: val });
                                }
                              }}
                              className="w-full text-[10px] bg-muted/30 border border-border/50 rounded-md px-1.5 py-1 text-foreground cursor-pointer hover:bg-muted/50 transition-colors appearance-none text-center truncate"
                            >
                              <option value="">Устройство</option>
                              {cellAvailableDevices.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {/* Датчики */}
                          {cellAvailableSensors.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                setCell(activeRoomId, col, row, { deviceId: val });
                              }}
                              className="w-full text-[10px] bg-muted/30 border border-border/50 rounded-md px-1.5 py-1 text-foreground cursor-pointer hover:bg-muted/50 transition-colors appearance-none text-center truncate"
                            >
                              <option value="">Датчик</option>
                              {cellAvailableSensors.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {/* Сценарии */}
                          {cellAvailableScenarios.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                setCell(activeRoomId, col, row, { scenarioId: val });
                              }}
                              className="w-full text-[10px] bg-muted/30 border border-border/50 rounded-md px-1.5 py-1 text-foreground cursor-pointer hover:bg-muted/50 transition-colors appearance-none text-center truncate"
                            >
                              <option value="">Сценарий</option>
                              {cellAvailableScenarios.map((sc) => (
                                <option key={sc.id} value={sc.id}>
                                  {sc.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {/* Виджеты */}
                          <select
                            value=""
                            onChange={(e) => {
                              const val = e.target.value as WidgetType;
                              if (!val) return;
                              const config = WIDGET_DEFAULTS[val];
                              setCell(activeRoomId, col, row, { widget: config });
                            }}
                            className="w-full text-[10px] bg-muted/30 border border-border/50 rounded-md px-1.5 py-1 text-foreground cursor-pointer hover:bg-muted/50 transition-colors appearance-none text-center truncate"
                          >
                            <option value="">Виджет</option>
                            {(Object.keys(WIDGET_META) as WidgetType[]).map((type) => (
                              <option key={type} value={type}>
                                {WIDGET_META[type].icon} {WIDGET_META[type].label}
                              </option>
                            ))}
                          </select>
                          {cellAvailableDevices.length === 0 && cellAvailableSensors.length === 0 && cellAvailableScenarios.length === 0 && (
                            <span className="text-[10px] text-muted-foreground/50">Все назначены</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              );
            })()}
          </div>

          {/* Background section */}
          <div className="mt-4 pt-4 border-t border-border/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  Фон комнаты{activeRoom ? `: ${activeRoom.name}` : ""}
                </span>
                {activeRoomBackground && (
                  <span className="text-[10px] text-muted-foreground">(установлен)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeRoomBackground && (
                  <button
                    onClick={() => setRoomBackground(activeRoomId!, null)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Удалить фон
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Загрузить фон
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    // Сжимаем картинку перед сохранением
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      if (ev.target?.result) {
                        const img = new window.Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const maxSize = 800;
                          let w = img.width;
                          let h = img.height;
                          if (w > maxSize || h > maxSize) {
                            if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                            else { w = Math.round(w * maxSize / h); h = maxSize; }
                          }
                          canvas.width = w;
                          canvas.height = h;
                          canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                          const compressed = canvas.toDataURL('image/jpeg', 0.7);
                          addUploadedImage(compressed);
                          setRoomBackground(activeRoomId!, compressed);
                        };
                        img.src = ev.target.result as string;
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {activeRoomBackground ? (
              <div className="max-w-md">
                <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/40">
                  <img
                    src={activeRoomBackground}
                    alt={`Фон комнаты ${activeRoom?.name ?? ""}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Этот фон отображается в юзер-панели для комнаты «{activeRoom?.name ?? ""}». Новая загрузка заменит его.
                </p>
              </div>
            ) : (
              <div className="max-w-md text-center py-6 rounded-lg border border-dashed border-border/60 bg-muted/20">
                <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-[11px] text-muted-foreground">Фон комнаты не установлен</p>
                <p className="text-[10px] text-muted-foreground/60">
                  Загрузите одно изображение — оно станет фоном комнаты «{activeRoom?.name ?? ""}»
                </p>
              </div>
            )}

            {uploadedImages.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] text-muted-foreground mb-2">
                  Ранее загруженные изображения (клик по картинке — установить фоном этой комнаты)
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {uploadedImages.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => setRoomBackground(activeRoomId!, img)}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group cursor-pointer ${
                        activeRoomBackground === img
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Фон ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {activeRoomBackground === img && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <span className="text-[10px] font-medium text-primary bg-background/80 px-1.5 py-0.5 rounded">
                            Активный
                          </span>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeUploadedImage(idx);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded bg-background/80 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Widget editing modal */}
      {editingWidget && (
        <Dialog open={!!editingWidget} onOpenChange={(open) => { if (!open) setEditingWidget(null); }}>
          <DialogContent className="sm:max-w-md p-4">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-sm font-medium">
                {WIDGET_META[editingWidget.config.type]?.icon}{" "}
                {WIDGET_META[editingWidget.config.type]?.label}
              </DialogTitle>
            </DialogHeader>

            <div className="h-48 mb-4 rounded-lg overflow-hidden border border-border/50">
              <WidgetRenderer
                config={editingWidget.config}
                onChange={(newConfig) => {
                  setEditingWidget({ ...editingWidget, config: newConfig });
                  const [col, row] = editingWidget.cellKey.split(",").map(Number);
                  setCell(activeRoomId, col, row, { ...cells[editingWidget.cellKey], widget: newConfig });
                }}
              />
            </div>

            <WidgetSettingsEditor
              config={editingWidget.config}
              onChange={(newConfig) => {
                setEditingWidget({ ...editingWidget, config: newConfig });
                const [col, row] = editingWidget.cellKey.split(",").map(Number);
                setCell(activeRoomId, col, row, { ...cells[editingWidget.cellKey], widget: newConfig });
              }}
              uploadedImages={uploadedImages}
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setEditingWidget(null)}>
                Закрыть
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
