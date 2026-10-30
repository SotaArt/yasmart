import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Code } from "lucide-react";
import {
  getDeviceTypeLabel,
  getSensorReadings,
  getDeviceCategoryLabel,
  getSignalInfo,
  type Device,
} from "@/lib/yandex";

const CAP_TYPE_LABELS: Record<string, string> = {
  "devices.capabilities.on_off": "Вкл/Выкл",
  "devices.capabilities.mode": "Режим",
  "devices.capabilities.range": "Диапазон",
  "devices.capabilities.toggle": "Переключатель",
  "devices.capabilities.color_setting": "Цвет",
};

const CAP_INSTANCE_LABELS: Record<string, string> = {
  on: "Включение",
  brightness: "Яркость",
  temperature: "Температура",
  thermostat: "Термостат",
  fan_speed: "Вентилятор",
  work_speed: "Скорость",
  swing: "Качание",
  night_mode: "Ночной режим",
  color_temperature: "Цветовая температура",
  temperature_k: "Цветовая температура",
  hsv: "Цвет HSV",
  rgb: "Цвет RGB",
  open: "Открытие",
  humidity: "Влажность",
};

const PROP_INSTANCE_LABELS: Record<string, string> = {
  temperature: "Температура",
  humidity: "Влажность",
  co2_level: "CO2",
  "pm2.5_density": "PM2.5",
  battery_level: "Батарея",
  motion: "Движение",
  open: "Открытие",
  presence: "Присутствие",
  vibration: "Вибрация",
  water_leak: "Протечка",
  illumination: "Освещённость",
  signal_strength: "Сигнал",
  rssi: "Сигнал",
  smoke: "Дым",
  gas: "Газ",
};

interface DeviceDetailsDialogProps {
  device: Device;
  token: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DeviceDetailsDialog({ device, token }: DeviceDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "raw">("summary");

  const signal = getSignalInfo(device) ?? { value: "N/A", label: "Нет данных", color: "text-muted-foreground" };
  const readings = getSensorReadings(device);
  const capabilityCount = device.capabilities?.length ?? 0;
  const propertyCount = device.properties?.length ?? 0;

  const handleCopy = async () => {
    const text = JSON.stringify(device, null, 2);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="w-6 h-6 rounded-md bg-muted/50 hover:bg-blue-500/20 hover:text-blue-400 text-muted-foreground flex items-center justify-center transition-colors"
          title="Свойства и функции"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span className="truncate">{device.name}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2 text-xs gap-1"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[hsl(var(--gold))]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? "Скопировано" : "JSON"}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/30 pb-2">
          <button
            onClick={() => setActiveTab("summary")}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              activeTab === "summary"
                ? "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Сводка
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              activeTab === "raw"
                ? "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            JSON
          </button>
        </div>

        <ScrollArea className="h-[65vh]">
          {activeTab === "summary" ? (
            <div className="space-y-4 text-sm">
              {/* Basic info */}
              <Section title="Технические данные">
                <InfoRow label="ID" value={device.id} mono />
                <InfoRow label="Тип" value={getDeviceTypeLabel(device.type)} />
                <InfoRow label="Тип (raw)" value={device.type} mono />
                {device.device_info?.manufacturer && (
                  <InfoRow label="Производитель" value={device.device_info.manufacturer} />
                )}
                {device.device_info?.model && (
                  <InfoRow label="Модель" value={device.device_info.model} mono />
                )}
                {device.device_info?.hw_version && (
                  <InfoRow label="HW версия" value={device.device_info.hw_version} mono />
                )}
                {device.device_info?.sw_version && (
                  <InfoRow label="SW версия" value={device.device_info.sw_version} mono />
                )}
                {device.device_info?.serial && (
                  <InfoRow label="Серийник" value={device.device_info.serial} mono />
                )}
                {device.device_info?.device_id && (
                  <InfoRow label="Device ID" value={device.device_info.device_id} mono />
                )}
                {device.external_id && (
                  <InfoRow label="External ID" value={device.external_id} mono />
                )}
                {device.room_id && (
                  <InfoRow label="Комната ID" value={device.room_id} mono />
                )}
                {device.household_id && (
                  <InfoRow label="Объект ID" value={device.household_id} mono />
                )}
                {device.skill_id && (
                  <InfoRow label="Skill ID" value={device.skill_id} mono />
                )}
                {device.type && (
                  <InfoRow label="Категория" value={getDeviceCategoryLabel(device)} />
                )}
              </Section>

              {/* Signal */}
              <Section title="Сигнал">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Уровень:</span>
                  <span className={`font-mono font-semibold ${signal.color}`}>
                    {signal.value}
                  </span>
                  <Badge variant="outline" className={`${signal.color} text-[10px]`}>
                    {signal.label}
                  </Badge>
                </div>
              </Section>

              {/* Sensor readings */}
              {Object.keys(readings).length > 0 && (
                <Section title="Показания датчиков">
                  {readings.temperature !== undefined && (
                    <InfoRow label="Температура" value={`${readings.temperature.toFixed(1)}°C`} />
                  )}
                  {readings.humidity !== undefined && (
                    <InfoRow label="Влажность" value={`${Math.round(readings.humidity)}%`} />
                  )}
                  {readings.battery !== undefined && (
                    <InfoRow label="Батарея" value={`${Math.round(readings.battery)}%`} />
                  )}
                  {readings.pm25 !== undefined && (
                    <InfoRow label="PM2.5" value={`${readings.pm25} мкг/м³`} />
                  )}
                  {readings.co2 !== undefined && (
                    <InfoRow label="CO2" value={`${readings.co2} ppm`} />
                  )}
                  {readings.illumination !== undefined && (
                    <InfoRow label="Освещённость" value={`${readings.illumination} лк`} />
                  )}
                  {readings.motion !== undefined && (
                    <InfoRow label="Движение" value={readings.motion ? "Обнаружено" : "Нет"} />
                  )}
                  {readings.open !== undefined && (
                    <InfoRow label="Открытие" value={readings.open ? "Открыто" : "Закрыто"} />
                  )}
                  {readings.presence !== undefined && (
                    <InfoRow label="Присутствие" value={readings.presence ? "Есть" : "Нет"} />
                  )}
                  {readings.vibration !== undefined && (
                    <InfoRow label="Вибрация" value={readings.vibration ? "Обнаружена" : "Нет"} />
                  )}
                  {readings.water_leak !== undefined && (
                    <InfoRow label="Протечка" value={readings.water_leak ? "Да" : "Нет"} />
                  )}
                </Section>
              )}

              {/* Capabilities */}
              {capabilityCount > 0 && (
                <Section title={`Возможности (${capabilityCount})`}>
                  <div className="space-y-2">
                    {device.capabilities?.map((cap, i) => {
                      const instance = cap.state?.instance ?? cap.parameters?.instance;
                      return (
                      <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">
                            {CAP_TYPE_LABELS[cap.type] ?? cap.type.split(".").pop()}
                            {instance && (
                              <span className="text-muted-foreground ml-1">
                                · {CAP_INSTANCE_LABELS[instance] ?? instance}
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-mono text-foreground">
                            {formatValue(cap.state?.value)}
                          </span>
                        </div>
                        {cap.parameters && (
                          <div className="text-[10px] text-muted-foreground">
                            Параметры: {JSON.stringify(cap.parameters)}
                          </div>
                        )}
                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                          {cap.retrievable !== undefined && (
                            <span>{cap.retrievable ? "✓ чтение" : "✗ чтение"}</span>
                          )}
                          {cap.reportable !== undefined && (
                            <span>{cap.reportable ? "✓ отчёт" : "✗ отчёт"}</span>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Properties */}
              {propertyCount > 0 && (
                <Section title={`Свойства (${propertyCount})`}>
                  <div className="space-y-2">
                    {device.properties?.map((prop, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">
                            {PROP_INSTANCE_LABELS[prop.parameters?.instance ?? ""] ?? prop.type.split(".").pop()}
                            {prop.parameters?.instance && (
                              <span className="text-muted-foreground ml-1">· {prop.parameters.instance}</span>
                            )}
                          </span>
                          <span className="text-xs font-mono text-foreground">
                            {formatValue(prop.state?.value)}
                          </span>
                        </div>
                        {prop.parameters && (
                          <div className="text-[10px] text-muted-foreground">
                            Параметры: {JSON.stringify(prop.parameters)}
                          </div>
                        )}
                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                          {prop.retrievable !== undefined && (
                            <span>{prop.retrievable ? "✓ чтение" : "✗ чтение"}</span>
                          )}
                          {prop.reportable !== undefined && (
                            <span>{prop.reportable ? "✓ отчёт" : "✗ отчёт"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Quasar info */}
              {device.quasar_info && Object.keys(device.quasar_info).length > 0 && (
                <Section title="Quasar информация">
                  <pre className="text-[10px] font-mono text-foreground bg-muted/30 p-2 rounded-lg overflow-x-auto">
                    {JSON.stringify(device.quasar_info, null, 2)}
                  </pre>
                </Section>
              )}

              {/* Aliases */}
              {device.aliases && device.aliases.length > 0 && (
                <Section title="Алиасы">
                  <div className="flex flex-wrap gap-1">
                    {device.aliases.map((alias, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {alias}
                      </Badge>
                    ))}
                  </div>
                </Section>
              )}

              {/* Groups */}
              {device.groups && device.groups.length > 0 && (
                <Section title="Группы">
                  <div className="flex flex-wrap gap-1">
                    {device.groups.map((group, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {group}
                      </Badge>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          ) : (
            /* Raw JSON tab */
            <pre className="text-[11px] font-mono text-foreground bg-muted/30 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(device, null, 2)}
            </pre>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs text-foreground ${mono ? "font-mono text-[10px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
