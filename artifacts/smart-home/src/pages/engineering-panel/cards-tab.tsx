import { useState, useMemo, useEffect } from "react";
import type { Device } from "@/lib/yandex";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DeviceGridCard } from "@/components/smart-card/DeviceGridCard";
import { matchDeviceToTemplate } from "@/lib/device-template-map";

interface CardsTabProps {
  devices: Device[];
  token: string;
}

/* ───────────────────────── Группы каталога ───────────────────────── */
interface LibraryGroup {
  id: string;
  label: string;
  icon: string;
}

const LIBRARY_GROUPS: LibraryGroup[] = [
  { id: "switch", label: "Выключатели и розетки", icon: "🔌" },
  { id: "light", label: "Освещение", icon: "💡" },
  { id: "climate", label: "Климат", icon: "❄️" },
  { id: "openable", label: "Шторы и замки", icon: "🪟" },
  { id: "media", label: "Медиа", icon: "🎵" },
  { id: "camera", label: "Камеры", icon: "📷" },
  { id: "appliance", label: "Бытовая техника", icon: "🤖" },
  { id: "sensor", label: "Датчики", icon: "📊" },
  { id: "meter", label: "Счётчики", icon: "📈" },
];

/* ─────────────────── Демо-устройства для каталога ─────────────────── */
function capc(type: string, instance: string, value: any, extra: Record<string, any> = {}): any {
  return { type, parameters: { instance, ...extra }, state: { instance, value } };
}

function evtc(instance: string, value: any, extra: Record<string, any> = {}): any {
  return { type: "devices.properties.event", parameters: { instance, ...extra }, state: { instance, value } };
}

function propc(instance: string, value: any, unit = "unit.percent"): any {
  return { type: "devices.properties.float", parameters: { instance, unit }, state: { instance, value } };
}

const RANGE_STEP = { step: 1, type: "integer" };

/** Собирает демо-устройство по specId (ТОЛЬКО для визуального каталога, без управления) */
function buildDemoDevice(specId: string, on: boolean, tick = 0): Device {
  const d = (name: string, type: string): Device =>
    ({ id: `demo-${specId}`, name, type, capabilities: [], properties: [] });

  switch (specId) {
    case "switch": {
      const dev = d("Демо · Выключатель", "devices.types.switch");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      return dev;
    }
    case "socket": {
      const dev = d("Демо · Розетка", "devices.types.socket");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.properties!.push(propc("power", on ? 150 : 0, "unit.watt"));
      dev.properties!.push(propc("voltage", on ? 224 : 0, "unit.volt"));
      dev.properties!.push(propc("electric_current", on ? 1.2 : 0, "unit.ampere"));
      return dev;
    }
    case "light-full": {
      const dev = d("Демо · Свет", "devices.types.light");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.range", "brightness", on ? 60 : 0, {
        min_value: 0, max_value: 100, ...RANGE_STEP,
      }));
      dev.capabilities!.push(capc("devices.capabilities.range", "color_temperature", on ? 3800 : 2700, {
        min_value: 2700, max_value: 6500, step: 100, type: "integer",
      }));
      dev.capabilities!.push(capc("devices.capabilities.color_setting", "color_scene", on ? { id: "scene_rainbow" } : { id: "scene_warm" }, {
        color_scene: {
          type: "basic",
          scenes: [
            { id: "scene_warm", scene_name: "Тёплый" },
            { id: "scene_cool", scene_name: "Холодный" },
            { id: "scene_red", scene_name: "Красный" },
            { id: "scene_green", scene_name: "Зелёный" },
            { id: "scene_blue", scene_name: "Синий" },
            { id: "scene_rainbow", scene_name: "Радуга" },
          ],
        },
      }));
      return dev;
    }
    case "light-strip": {
      const dev = d("Демо · LED-лента", "devices.types.light.strip");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.range", "brightness", on ? 60 : 0, {
        min_value: 0, max_value: 100, ...RANGE_STEP,
      }));
      dev.capabilities!.push(capc("devices.capabilities.range", "color_temperature", on ? 3800 : 2700, {
        min_value: 2700, max_value: 6500, step: 100, type: "integer",
      }));
      dev.capabilities!.push(capc("devices.capabilities.color_setting", "color_scene", on ? { id: "scene_rainbow" } : { id: "scene_warm" }, {
        color_scene: {
          type: "basic",
          scenes: [
            { id: "scene_warm", scene_name: "Тёплый" },
            { id: "scene_cool", scene_name: "Холодный" },
            { id: "scene_red", scene_name: "Красный" },
            { id: "scene_green", scene_name: "Зелёный" },
            { id: "scene_blue", scene_name: "Синий" },
            { id: "scene_rainbow", scene_name: "Радуга" },
          ],
        },
      }));
      return dev;
    }
    case "ac": {
      const dev = d("Демо · Кондиционер", "devices.types.thermostat.ac");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.range", "temperature", on ? 22 : 26, {
        min_value: 16, max_value: 30, step: 0.5, type: "float",
      }));
      dev.capabilities!.push(capc("devices.capabilities.mode", "thermostat", on ? "cool" : "auto", {
        modes: [
          { value: "auto", name: "Авто" }, { value: "cool", name: "Холод" },
          { value: "heat", name: "Тепло" }, { value: "dry", name: "Осушение" },
          { value: "fan_only", name: "Вентиляция" },
        ],
      }));
      dev.capabilities!.push(capc("devices.capabilities.range", "fan_speed", on ? 3 : 1, {
        min_value: 1, max_value: 3, ...RANGE_STEP,
      }));
      dev.capabilities!.push(capc("devices.capabilities.mode", "swing", on ? "medium" : "low", {
        modes: [
          { value: "low", name: "Слабо" }, { value: "medium", name: "Средне" },
          { value: "high", name: "Сильно" },
        ],
      }));
      return dev;
    }
    case "thermostat-floor": {
      const dev = d("Демо · Тёплый пол", "devices.types.thermostat");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.range", "temperature", on ? 24 : 18, {
        min_value: 18, max_value: 45, step: 0.5, type: "float",
      }));
      dev.capabilities!.push(capc("devices.capabilities.mode", "thermostat", on ? "heat" : "auto", {
        modes: [
          { value: "auto", name: "Авто" }, { value: "heat", name: "Тепло" },
          { value: "dry", name: "Осушение" },
        ],
      }));
      // Текущая температура пола: при включении медленно растёт к целевой (24°),
      // при выключении — остывает к комнатной (18°)
      const floorCurrent = on
        ? Math.min(24, 18 + (tick * 0.5))
        : Math.max(18, 22 - (tick * 0.5));
      dev.properties!.push(propc("temperature", Math.round(floorCurrent * 10) / 10, "unit.temperature.celsius"));
      return dev;
    }
    case "thermostat-radiator": {
      const dev = d("Демо · Радиатор", "devices.types.thermostat");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.range", "temperature", on ? 22 : 16, {
        min_value: 16, max_value: 35, step: 0.5, type: "float",
      }));
      dev.capabilities!.push(capc("devices.capabilities.mode", "thermostat", on ? "heat" : "auto", {
        modes: [
          { value: "auto", name: "Авто" }, { value: "heat", name: "Тепло" },
        ],
      }));
      return dev;
    }
    case "heater": {
      const dev = d("Демо · Обогреватель", "devices.types.thermostat.heater");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.range", "temperature", on ? 25 : 18, {
        min_value: 16, max_value: 45, step: 0.5, type: "float",
      }));
      dev.capabilities!.push(capc("devices.capabilities.mode", "thermostat", on ? "heat" : "auto", {
        modes: [
          { value: "auto", name: "Авто" }, { value: "heat", name: "Тепло" },
          { value: "dry", name: "Осушение" },
        ],
      }));
      return dev;
    }
    case "humidifier": {
      const dev = d("Демо · Увлажнитель", "devices.types.humidifier");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.mode", "work_speed", on ? "medium" : "low", {
        modes: [
          { value: "auto", name: "Авто" }, { value: "low", name: "Низкая" },
          { value: "medium", name: "Средняя" }, { value: "high", name: "Высокая" },
        ],
      }));
      dev.properties!.push(propc("humidity", on ? 58 : 42));
      return dev;
    }
    case "purifier": {
      const dev = d("Демо · Очиститель", "devices.types.purifier");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.mode", "work_speed", on ? "auto" : "low", {
        modes: [
          { value: "auto", name: "Авто" }, { value: "low", name: "Низкая" },
          { value: "medium", name: "Средняя" }, { value: "high", name: "Высокая" },
        ],
      }));
      dev.properties!.push(propc("humidity", on ? 51 : 45));
      dev.properties!.push(propc("pm2.5_density", on ? 12 : 34, "unit.mcg_m3"));
      return dev;
    }
    case "fan": {
      const dev = d("Демо · Вентиляция", "devices.types.ventilation");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.mode", "work_speed", on ? "high" : "low", {
        modes: [
          { value: "auto", name: "Авто" }, { value: "low", name: "Низкая" },
          { value: "medium", name: "Средняя" }, { value: "high", name: "Высокая" },
          { value: "turbo", name: "Турбо" },
        ],
      }));
      dev.capabilities!.push(capc("devices.capabilities.range", "fan_speed", on ? 3 : 1, {
        min_value: 1, max_value: 5, ...RANGE_STEP,
      }));
      return dev;
    }
    case "hood": {
      const dev = d("Демо · Вытяжка", "devices.types.cooking.hood");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.mode", "fan_speed", on ? "turbo" : "low", {
        modes: [
          { value: "auto", name: "Авто" }, { value: "low", name: "Низкая" },
          { value: "high", name: "Высокая" }, { value: "turbo", name: "Турбо" },
        ],
      }));
      return dev;
    }
    case "curtain": {
      const dev = d("Демо · Шторы", "devices.types.openable.curtain");
      dev.capabilities!.push(capc("devices.capabilities.range", "open", on ? 60 : 0, {
        min_value: 0, max_value: 100, ...RANGE_STEP,
      }));
      return dev;
    }
    case "lock": {
      const dev = d("Демо · Замок", "devices.types.openable.door_lock");
      dev.capabilities!.push(capc("devices.capabilities.toggle", "lock", on));
      dev.properties!.push(propc("battery_level", 85));
      return dev;
    }
    case "tv": {
      const dev = d("Демо · Телевизор", "devices.types.media_device.tv");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.mode", "playback", on ? "playing" : "paused", {
        modes: [
          { value: "playing", name: "Воспроизведение" }, { value: "paused", name: "Пауза" },
        ],
      }));
      dev.capabilities!.push(capc("devices.capabilities.range", "volume", on ? 45 : 0, {
        min_value: 0, max_value: 100, ...RANGE_STEP,
      }));
      return dev;
    }
    case "camera": {
      const dev = d("Демо · Камера", "devices.types.camera");
      (dev as any).status = "online";
      return dev;
    }
    case "vacuum": {
      const dev = d("Демо · Пылесос", "devices.types.vacuum_cleaner");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.mode", "fan_speed", "normal", {
        modes: [
          { value: "quiet", name: "Тихо" }, { value: "normal", name: "Норма" },
          { value: "turbo", name: "Турбо" },
        ],
      }));
      dev.properties!.push(propc("battery_level", on ? 82 : 100));
      return dev;
    }
    case "sensor-climate": {
      const dev = d("Демо · Датчик климата", "devices.types.sensor.climate");
      dev.properties!.push(propc("temperature", 23.6));
      dev.properties!.push(propc("humidity", 58));
      dev.properties!.push(propc("battery_level", 85));
      dev.properties!.push(propc("co2_level", 460, "unit.ppm"));
      return dev;
    }
    case "sensor-leak": {
      const dev = d("Демо · Датчик протечки", "devices.types.sensor.water_leak");
      dev.properties!.push(evtc("water_leak", false, { updated_at: new Date().toISOString() }));
      return dev;
    }
    case "kettle": {
      const dev = d("Демо · Общая карточка", "devices.types.cooking.kettle");
      dev.capabilities!.push(capc("devices.capabilities.on_off", "on", on));
      dev.capabilities!.push(capc("devices.capabilities.range", "temperature", 100, {
        min_value: 0, max_value: 100, ...RANGE_STEP,
      }));
      return dev;
    }
    default:
      return d("Демо · Устройство", "devices.types.other");
  }
}

/** Образцы для каталога: каждый рендерит конкретный компонент из smart-card */
interface CatalogEntry { id: string; label: string; icon: string; groupId: string; }

const CATALOG: CatalogEntry[] = [
  { id: "switch", label: "Выключатель", icon: "🔌", groupId: "switch" },
  { id: "socket", label: "Розетка", icon: "🔋", groupId: "switch" },
  { id: "light-full", label: "Свет", icon: "💡", groupId: "light" },
  { id: "light-strip", label: "LED-лента", icon: "🌈", groupId: "light" },
  { id: "ac", label: "Кондиционер", icon: "❄️", groupId: "climate" },
  { id: "thermostat-floor", label: "Тёплый пол", icon: "🌡️", groupId: "climate" },
  { id: "thermostat-radiator", label: "Радиатор", icon: "♨️", groupId: "climate" },
  { id: "heater", label: "Обогреватель", icon: "🔥", groupId: "climate" },
  { id: "humidifier", label: "Увлажнитель", icon: "💧", groupId: "climate" },
  { id: "purifier", label: "Очиститель", icon: "🌬️", groupId: "climate" },
  { id: "fan", label: "Вентиляция", icon: "🌀", groupId: "climate" },
  { id: "hood", label: "Вытяжка", icon: "💨", groupId: "climate" },
  { id: "curtain", label: "Шторы", icon: "🪟", groupId: "openable" },
  { id: "lock", label: "Замок", icon: "🔐", groupId: "openable" },
  { id: "tv", label: "Медиа", icon: "📺", groupId: "media" },
  { id: "camera", label: "Камера", icon: "📷", groupId: "camera" },
  { id: "vacuum", label: "Пылесос", icon: "🤖", groupId: "appliance" },
  { id: "kettle", label: "Общая карточка", icon: "🌀", groupId: "appliance" },
  { id: "sensor-climate", label: "Датчик климата", icon: "📊", groupId: "sensor" },
  { id: "sensor-leak", label: "Датчик протечки", icon: "🌊", groupId: "sensor" },
];

/* ───────────────────────── Немного UI ───────────────────────── */

function SegmentedButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
        active
          ? "bg-[#d4af37]/20 text-[#f3e5ab] border-[#d4af37]/50 shadow-[0_0_12px_rgba(212,175,55,0.15)]"
          : "text-muted-foreground border-border/40 hover:text-foreground hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

function GroupSection({ title, icon, count, open, onToggle, children }: {
  title: string; icon: string; count: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-border/30 rounded-lg overflow-hidden bg-background/40">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
      >
        <span className="text-base leading-none">{icon}</span>
        <span className="flex-1 text-xs font-semibold">{title}</span>
        <span className="text-[10px] text-muted-foreground">{count}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="p-3 border-t border-border/30">{children}</div>}
    </div>
  );
}

/* ───────────────────────── Компонент ───────────────────────── */

export function CardsTab({ devices, token }: CardsTabProps) {
  const [demoOn, setDemoOn] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  // Тик анимации демо-температуры (тёплый пол «нагревается»/«остывает»)
  const [demoTick, setDemoTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDemoTick((t) => t + 1), 600);
    return () => clearInterval(id);
  }, []);

  const groupIsOpen = (id: string) => openGroups[id] ?? true;

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));

  // Сколько реальных устройств в проекте использует каждую карточку (по типу)
  const liveCountByTemplate = useMemo(() => {
    const map: Record<string, number> = {};
    devices.forEach(dev => {
      const t = matchDeviceToTemplate(dev);
      if (t) map[t] = (map[t] ?? 0) + 1;
    });
    return map;
  }, [devices]);

  // Каталог: сгруппированные записи + демо-устройства
  const catalogByGroup = useMemo(() => {
    const map: Record<string, CatalogEntry[]> = {};
    CATALOG.forEach(e => (map[e.groupId] ??= []).push(e));
    return map;
  }, []);

  const demoDevices = useMemo(
    () => Object.fromEntries(CATALOG.map(e => [e.id, buildDemoDevice(e.id, demoOn, demoTick)])),
    [demoOn, demoTick]
  );

  const filteredCatalog = CATALOG.filter(e =>
    search.trim() === "" || e.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const catalogCell = (entry: CatalogEntry) => {
    const demo = demoDevices[entry.id];
    if (!demo) return null;
    // Освещение «Свет»: считаем все обычные световые шаблоны (кроме strip, у которого свой счётчик)
    const count =
      entry.id === "light-full"
        ? ["light-onoff", "light-dimmer", "light-color", "light-temp", "light-full"]
            .reduce((acc, t) => acc + (liveCountByTemplate[t] ?? 0), 0)
        : liveCountByTemplate[entry.id] ?? 0;
    return (
      <div key={entry.id} className="space-y-1.5">
        <div
          className="relative rounded-xl bg-gradient-to-b from-[#14161c] to-[#0b0d11] border border-[#d4af37]/20 p-1"
          title="Демо-образец · управление отключено"
        >
          <div className="pointer-events-none select-none">
            <DeviceGridCard device={demo} token={token} size="standard" />
          </div>
          <span className="pointer-events-none absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f3e5ab] text-[9px] font-mono">
            ДЕМО
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-xs">{entry.icon}</span>
          <span className="text-[11px] text-muted-foreground">{entry.label}</span>
          {count > 0 && (
            <span className="ml-auto text-[10px] font-semibold text-[#f3e5ab] border border-[#d4af37]/40 bg-[#d4af37]/15 rounded-lg px-1.5 py-0.5">
              ×{count} в проекте
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Панель библиотеки */}
      <div className="border border-[#d4af37]/25 rounded-lg overflow-hidden bg-gradient-to-b from-[#14161c] to-[#0b0d11]">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-[#d4af37]/15">
          <span className="text-xs font-semibold text-[#f3e5ab]">
            📚 Каталог карточек
          </span>

          <span className="w-px h-5 bg-[#d4af37]/20 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Состояние:</span>
            <SegmentedButton active={demoOn} onClick={() => setDemoOn(true)}>ВКЛ</SegmentedButton>
            <SegmentedButton active={!demoOn} onClick={() => setDemoOn(false)}>ВЫКЛ</SegmentedButton>
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по карточкам…"
            className="ml-auto min-w-[140px] px-2 py-1 rounded-lg text-[11px] bg-slate-900/70 border border-slate-700/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4af37]/50"
          />
        </div>

        <p className="px-3 pt-2 text-[10px] text-muted-foreground leading-relaxed">
          Единая библиотека карточек — ЮП рендерит ровно эти компоненты, что видишь здесь в демо.
          Все карточки следуют единому шаблону: заголовок → разделитель → функциональные элементы → круглая кнопка питания по центру → разделитель → таймер.
          Освещение: одна универсальная карточка «Свет» (💡) + отдельная для «LED-лента» (🌈), каждая подстраивается
          под функционал согласно API. Бейдж «×N в проекте» — сколько реальных устройств используют карточку.
          Демо-образцы не управляют устройствами.
        </p>

        {/* ── Каталог ── */}
        <div className="p-3 space-y-3">
          {LIBRARY_GROUPS.map(group => {
            const entries = catalogByGroup[group.id] ?? [];
            const items = search.trim() === ""
              ? entries
              : entries.filter(e => e.label.toLowerCase().includes(search.trim().toLowerCase()));
            if (items.length === 0) return null;
            return (
              <GroupSection
                key={group.id}
                title={group.label}
                icon={group.icon}
                count={`${items.length} ${items.length === 1 ? "образец" : "образца"}`}
                open={groupIsOpen(`cat-${group.id}`)}
                onToggle={() => toggleGroup(`cat-${group.id}`)}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {items.map(catalogCell)}
                </div>
              </GroupSection>
            );
          })}
          {filteredCatalog.length === 0 && (
            <p className="text-[11px] text-muted-foreground py-6 text-center">Ничего не найдено.</p>
          )}
        </div>
      </div>
    </div>
  );
}