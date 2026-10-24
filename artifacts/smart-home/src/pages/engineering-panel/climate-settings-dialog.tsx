import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Thermometer, Wind, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClimateConfig, EngineScenario } from "@/lib/engine-api";

interface ClimateSettingsDialogProps {
  scenario: EngineScenario;
  devices: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: Partial<EngineScenario>) => void;
}

const DEVICE_ROLES: { key: keyof ClimateConfig["devices"]; label: string; required?: boolean }[] = [
  { key: "roomTemp", label: "Датчик температуры в комнате", required: true },
  { key: "supplyTemp", label: "Датчик температуры притока" },
  { key: "outdoorTemp", label: "Датчик наружной температуры" },
  { key: "vent", label: "Вентиляция (вкл/выкл)" },
  { key: "supplyHeater", label: "Нагреватель притока" },
  { key: "radiator", label: "Радиатор" },
  { key: "floor", label: "Тёплый пол" },
  { key: "electricHeater", label: "Электроконвектор" },
  { key: "ac", label: "Кондиционер (AC)" },
];

const TARGETS: { key: keyof ClimateConfig["targets"]; label: string }[] = [
  { key: "home", label: "Дома" },
  { key: "away", label: "Уехал" },
  { key: "night", label: "Ночь" },
  { key: "morning", label: "Утро" },
  { key: "supply", label: "Приток" },
  { key: "acCool", label: "AC цель" },
  { key: "acOnThreshold", label: "AC порог включения" },
];

const TIMES: { key: keyof ClimateConfig["times"]; label: string }[] = [
  { key: "nightStart", label: "Начало ночи" },
  { key: "nightEnd", label: "Конец ночи" },
  { key: "morningStart", label: "Начало утра" },
  { key: "morningEnd", label: "Конец утра" },
];

const PRIORITIES: { value: "radiator" | "floor" | "electricHeater"; label: string }[] = [
  { value: "radiator", label: "Радиатор" },
  { value: "floor", label: "Тёплый пол" },
  { value: "electricHeater", label: "Конвектор" },
];

export function ClimateSettingsDialog({
  scenario,
  devices,
  open,
  onOpenChange,
  onSave,
}: ClimateSettingsDialogProps) {
  const base = scenario.climate!;
  const [draft, setDraft] = useState<ClimateConfig>(() => ({
    ...base,
    devices: { ...base.devices },
    targets: { ...base.targets },
    times: { ...base.times },
    safety: { ...base.safety },
    priorities: [...base.priorities],
  }));

  const deviceOptions = useMemo(
    () =>
      devices
        .filter(
          (d: any) => (d.capabilities && d.capabilities.length > 0) || (d.properties && d.properties.length > 0)
        )
        .map((d: any) => ({ id: d.id, name: d.name })),
    [devices]
  );

  const setDevice = (key: keyof ClimateConfig["devices"], value: string) => {
    setDraft((d) => ({ ...d, devices: { ...d.devices, [key]: value || undefined } }));
  };

  const setTarget = (key: keyof ClimateConfig["targets"], value: string) => {
    const n = Number(value);
    if (Number.isFinite(n)) {
      setDraft((d) => ({ ...d, targets: { ...d.targets, [key]: n } }));
    }
  };

  const setTime = (key: keyof ClimateConfig["times"], value: string) => {
    setDraft((d) => ({ ...d, times: { ...d.times, [key]: value } }));
  };

  const movePriority = (idx: number, dir: -1 | 1) => {
    setDraft((d) => {
      const next = [...d.priorities];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return d;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...d, priorities: next };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройка «Климат»</DialogTitle>
          <DialogDescription>
            Управляемые устройства, целевые температуры и расписание режимов.
            Изменения применяются со следующего цикла движка.
          </DialogDescription>
        </DialogHeader>

        {/* Устройства */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <Thermometer className="w-3.5 h-3.5" /> Устройства
          </p>
          {DEVICE_ROLES.map((role) => (
            <div key={role.key} className="flex items-center gap-3">
              <Label className="w-44 text-xs flex-shrink-0">
                {role.label}
                {role.required && <span className="text-amber-500"> *</span>}
              </Label>
              <Select
                value={draft.devices[role.key]}
                onValueChange={(v) => setDevice(role.key, v)}
              >
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="— не задано —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— не задано —</SelectItem>
                  {deviceOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="h-px bg-border/30 my-1" />

        {/* Цели */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Целевые температуры (°C)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TARGETS.map((t) => (
              <div key={t.key}>
                <Label className="text-[11px] text-muted-foreground">{t.label}</Label>
                <Input
                  type="number"
                  step="0.5"
                  className="h-8 mt-1"
                  value={draft.targets[t.key]}
                  onChange={(e) => setTarget(t.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Расписание */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Расписание режимов</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TIMES.map((t) => (
              <div key={t.key}>
                <Label className="text-[11px] text-muted-foreground">{t.label}</Label>
                <Input
                  type="time"
                  className="h-8 mt-1"
                  value={draft.times[t.key]}
                  onChange={(e) => setTime(t.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Параметры */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Гистерезис (°C)</Label>
            <Input
              type="number"
              step="0.1"
              className="h-8 mt-1"
              value={draft.hysteresis}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setDraft((d) => ({ ...d, hysteresis: n }));
              }}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Цель пола = комн. + (°C)</Label>
            <Input
              type="number"
              step="0.5"
              className="h-8 mt-1"
              value={draft.floorOffset}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setDraft((d) => ({ ...d, floorOffset: n }));
              }}
            />
          </div>
        </div>

        {/* Приоритеты отопления */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Приоритет отопления</p>
          <div className="space-y-1.5">
            {draft.priorities.map((p, i) => {
              const info = PRIORITIES.find((x) => x.value === p)!;
              return (
                <div key={p} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                      {i + 1}
                    </span>
                    {info.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => movePriority(i, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === draft.priorities.length - 1} onClick={() => movePriority(i, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Безопасность */}
        <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <div>
              <p className="text-xs font-medium">Нагреватель притока только при включённой вентиляции</p>
              <p className="text-[10px] text-muted-foreground">Защита от нагрева без потока воздуха</p>
            </div>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-500 cursor-pointer"
            checked={draft.safety.heaterRequiresVent}
            onChange={(e) => setDraft((d) => ({ ...d, safety: { ...d.safety, heaterRequiresVent: e.target.checked } }))}
          />
        </div>

        {/* Периодичность */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Коулдаун команды (сек)</Label>
            <Input
              type="number"
              step="5"
              className="h-8 mt-1"
              value={Math.round(draft.commandCooldownMs / 1000)}
              onChange={(e) => {
                const n = Number(e.target.value) * 1000;
                if (Number.isFinite(n)) setDraft((d) => ({ ...d, commandCooldownMs: n }));
              }}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Коулдаун AC (мин)</Label>
            <Input
              type="number"
              step="1"
              className="h-8 mt-1"
              value={Math.round(draft.safety.minAcModeChangeIntervalMs / 60_000)}
              onChange={(e) => {
                const n = Number(e.target.value) * 60_000;
                if (Number.isFinite(n)) setDraft((d) => ({ ...d, safety: { ...d.safety, minAcModeChangeIntervalMs: n } }));
              }}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => onSave({ climate: draft })}>
            <Wind className="w-4 h-4 mr-1.5" /> Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}