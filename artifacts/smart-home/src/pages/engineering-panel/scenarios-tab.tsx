import { useState, useRef, useEffect } from "react";
import { Play, AlertTriangle, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Scenario {
  id: string;
  name: string;
  is_active?: boolean;
}

interface Room {
  id: string;
  name: string;
}

interface ScenariosTabProps {
  scenarios: Scenario[];
  rooms: Room[];
  onRun: (id: string) => void;
  isPending: boolean;
  error?: Error | null;
  isScenarioVisible: (id: string) => boolean;
  onToggleVisible: (id: string, visible: boolean) => void;
  getScenarioRooms: (id: string) => string[];
  onToggleScenarioRoom: (id: string, roomId: string) => void;
  onSetAllRooms: (id: string) => void;
}

function RoomPicker({
  scenarioId,
  rooms,
  selectedRooms,
  onToggle,
  onAll,
}: {
  scenarioId: string;
  rooms: Room[];
  selectedRooms: string[];
  onToggle: (roomId: string) => void;
  onAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const isAll = selectedRooms.length === 0;
  const label = isAll
    ? "Все комнаты"
    : selectedRooms.length === 1
      ? rooms.find((r) => r.id === selectedRooms[0])?.name ?? selectedRooms[0]
      : `${selectedRooms.length} комн.`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] bg-muted/50 border border-border/50 rounded-md px-2 py-1 text-foreground cursor-pointer hover:bg-muted/80 transition-colors max-w-[140px] truncate"
        title="Выбрать комнаты"
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border/50 rounded-lg shadow-lg p-1 min-w-[160px]">
          <button
            onClick={() => { onAll(); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
              isAll ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
            }`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
              isAll ? "bg-primary border-primary" : "border-border/70"
            }`}>
              {isAll && <Check className="w-3 h-3 text-primary-foreground" />}
            </span>
            Все комнаты
          </button>
          <div className="h-px bg-border/30 my-1" />
          {rooms.map((r) => {
            const checked = selectedRooms.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  checked ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  checked ? "bg-primary border-primary" : "border-border/70"
                }`}>
                  {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                </span>
                {r.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ScenariosTab({
  scenarios,
  rooms,
  onRun,
  isPending,
  error,
  isScenarioVisible,
  onToggleVisible,
  getScenarioRooms,
  onToggleScenarioRoom,
  onSetAllRooms,
}: ScenariosTabProps) {
  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Загрузка сценариев...
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Не удалось загрузить сценарии</p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Возможные причины:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Токен не имеет доступа к сценариям (scope: <code className="text-primary">iot:read</code> + <code className="text-primary">iot:control</code>)</li>
                <li>Сценарии не созданы в приложении "Умный дом" Яндекса</li>
                <li>Истёк срок действия токена</li>
              </ul>
              <p className="mt-2">Для доступа к сценариям необходимо в приложении "Умный дом" Яндекса:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Создать хотя бы один сценарий</li>
                <li>Убедиться, что OAuth-токен имеет права <code className="text-primary">iot:read</code> и <code className="text-primary">iot:control</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground text-center">
          Сценарии не найдены
        </p>
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-4 space-y-1">
          <p>Для отображения сценариев:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>Создайте сценарий в приложении "Умный дом" Яндекса</li>
            <li>Убедитесь, что OAuth-токен имеет права <code className="text-primary">iot:view</code> и <code className="text-primary">iot:control</code></li>
          </ul>
        </div>
      </div>
    );
  }

  const visibleCount = scenarios.filter((sc) => isScenarioVisible(sc.id)).length;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        {scenarios.length} сценариев · {visibleCount} видимых в юзер-панели
      </p>
      <div className="space-y-2">
        {scenarios.map((sc) => {
          const visible = isScenarioVisible(sc.id);
          const selectedRooms = getScenarioRooms(sc.id);

          return (
            <div
              key={sc.id}
              className={`flex items-center justify-between bg-card border rounded-xl px-4 py-3 transition-colors ${
                visible ? "border-border/50" : "border-border/30 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Play className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{sc.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{sc.id}</p>
                </div>
                {sc.is_active !== undefined && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      sc.is_active
                        ? "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30"
                        : "bg-muted text-muted-foreground border-border/50"
                    }`}
                  >
                    {sc.is_active ? "Активен" : "Неактивен"}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {visible && (
                  <RoomPicker
                    scenarioId={sc.id}
                    rooms={rooms}
                    selectedRooms={selectedRooms}
                    onToggle={(roomId) => onToggleScenarioRoom(sc.id, roomId)}
                    onAll={() => onSetAllRooms(sc.id)}
                  />
                )}

                <button
                  onClick={() => onToggleVisible(sc.id, !visible)}
                  className={`p-1.5 rounded-md transition-colors ${
                    visible
                      ? "text-primary hover:text-primary/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={visible ? "Скрыть из юзер-панели" : "Показать в юзер-панели"}
                >
                  {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRun(sc.id)}
                  disabled={isPending}
                  className="border-border/70 hover:border-primary/50 hover:text-primary text-sm"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Запуск
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
