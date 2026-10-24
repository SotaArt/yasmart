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
import { ClipboardList, Copy, Check } from "lucide-react";
import {
  getDeviceTypeLabel,
  getDeviceCapability,
  type Device,
  type Room,
  type Household,
} from "@/lib/yandex";

interface DeviceInventoryDialogProps {
  households: Household[];
  rooms: Room[];
  devices: Device[];
  selectedHouseholdId: string | null;
}

function getSignalLevel(device: Device): { value: string; label: string; color: string } {
  // Try to find signal_strength property
  const signalProp = device.properties?.find(
    (p) => p.parameters?.instance === "signal_strength" || p.parameters?.instance === "rssi"
  );
  const rawValue = signalProp?.state?.value;

  if (rawValue === undefined || rawValue === null) {
    return { value: "N/A", label: "Нет данных", color: "text-muted-foreground" };
  }

  const numValue = Number(rawValue);

  // RSSI interpretation (typical WiFi/Zigbee range)
  if (device.type.includes("sensor") || device.type.includes("switch") || device.type.includes("light")) {
    // Zigbee devices - signal is usually 0-255 or percentage
    if (numValue >= 75) return { value: `${numValue}`, label: "Отлично", color: "text-[hsl(var(--gold))]" };
    if (numValue >= 40) return { value: `${numValue}`, label: "Хорошо", color: "text-yellow-400" };
    return { value: `${numValue}`, label: "Плохо", color: "text-red-400" };
  }

  // WiFi devices - RSSI in dBm (negative values, closer to 0 is better)
  if (numValue > -50) return { value: `${numValue} dBm`, label: "Отлично", color: "text-[hsl(var(--gold))]" };
  if (numValue > -70) return { value: `${numValue} dBm`, label: "Хорошо", color: "text-yellow-400" };
  return { value: `${numValue} dBm`, label: "Плохо", color: "text-red-400" };
}

function getDeviceFunctions(device: Device): string {
  const funcs: string[] = [];

  // Check capabilities
  if (getDeviceCapability(device, "devices.capabilities.on_off")) funcs.push("Вкл/Выкл");
  if (getDeviceCapability(device, "devices.capabilities.range", "brightness")) funcs.push("Яркость");
  if (getDeviceCapability(device, "devices.capabilities.range", "temperature")) funcs.push("Температура");
  if (getDeviceCapability(device, "devices.capabilities.range", "fan_speed")) funcs.push("Вентилятор");
  if (getDeviceCapability(device, "devices.capabilities.mode", "thermostat")) funcs.push("Режим");
  if (getDeviceCapability(device, "devices.capabilities.mode", "swing")) funcs.push("Оswing");
  if (getDeviceCapability(device, "devices.capabilities.toggle", "night_mode")) funcs.push("Ночь");

  // Check properties
  const props = device.properties ?? [];
  if (props.some((p) => p.parameters?.instance === "temperature")) funcs.push("Темп.");
  if (props.some((p) => p.parameters?.instance === "humidity")) funcs.push("Влажн.");
  if (props.some((p) => p.parameters?.instance === "motion")) funcs.push("Движение");
  if (props.some((p) => p.parameters?.instance === "open")) funcs.push("Открытие");
  if (props.some((p) => p.parameters?.instance === "battery_level")) funcs.push("Батарея");
  if (props.some((p) => p.parameters?.instance === "co2_level")) funcs.push("CO2");
  if (props.some((p) => p.parameters?.instance === "pm2.5_density")) funcs.push("PM2.5");
  if (props.some((p) => p.parameters?.instance === "illumination")) funcs.push("Освещённость");
  if (props.some((p) => p.parameters?.instance === "water_leak")) funcs.push("Протечка");
  if (props.some((p) => p.parameters?.instance === "vibration")) funcs.push("Вибрация");

  return funcs.length > 0 ? funcs.join(", ") : getDeviceTypeLabel(device.type);
}

function getManufacturer(device: Device): string {
  if (device.device_info?.manufacturer) return device.device_info.manufacturer;
  if (device.skill_id) return device.skill_id;
  return "—";
}

function formatDeviceList(
  household: Household,
  rooms: Room[],
  devices: Device[]
): string {
  const lines: string[] = [];
  lines.push(`Название Объекта: ${household.name}`);
  lines.push("");

  // Group devices by room
  const roomMap = new Map<string, { room: Room | null; devices: Device[] }>();

  // Add devices with rooms
  for (const room of rooms) {
    if (room.household_id === household.id) {
      const roomDevices = devices.filter(
        (d) => d.room_id === room.id && d.household_id === household.id
      );
      if (roomDevices.length > 0) {
        roomMap.set(room.id, { room, devices: roomDevices });
      }
    }
  }

  // Add devices without rooms
  const unroomed = devices.filter(
    (d) => d.household_id === household.id && (!d.room_id || !rooms.find((r) => r.id === d.room_id))
  );
  if (unroomed.length > 0) {
    roomMap.set("__unroomed__", { room: null, devices: unroomed });
  }

  for (const [, { room, devices: roomDevices }] of roomMap) {
    lines.push(`Комната: ${room?.name ?? "Без комнаты"}`);
    lines.push("—".repeat(40));

    for (const device of roomDevices) {
      const signal = getSignalLevel(device);
      const functions = getDeviceFunctions(device);
      const manufacturer = getManufacturer(device);

      lines.push(
        `${device.name} | ${functions} | ${manufacturer} | ${signal.value} (${signal.label})`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function DeviceInventoryDialog({
  households,
  rooms,
  devices,
  selectedHouseholdId,
}: DeviceInventoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const household = households.find((h) => h.id === selectedHouseholdId) ?? households[0];
  if (!household) return null;

  const householdRooms = rooms.filter((r) => r.household_id === household.id);
  const householdDevices = devices.filter((d) => d.household_id === household.id);

  const handleCopy = async () => {
    const text = formatDeviceList(household, householdRooms, householdDevices);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Инвентарь
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Инвентарь устройств — {household.name}</span>
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
              {copied ? "Скопировано" : "Копировать"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          <div className="space-y-6 text-sm">
            {householdRooms.length === 0 && householdDevices.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Нет устройств для отображения
              </p>
            ) : (
              <>
                {/* Group by room */}
                {householdRooms.map((room) => {
                  const roomDevices = householdDevices.filter(
                    (d) => d.room_id === room.id
                  );
                  if (roomDevices.length === 0) return null;

                  return (
                    <div key={room.id}>
                      <h4 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                        <span className="text-muted-foreground">Комната:</span>
                        {room.name}
                      </h4>
                      <div className="ml-2 space-y-1">
                        {roomDevices.map((device) => (
                          <DeviceRow key={device.id} device={device} />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Devices without room */}
                {(() => {
                  const unroomed = householdDevices.filter(
                    (d) =>
                      !d.room_id ||
                      !householdRooms.find((r) => r.id === d.room_id)
                  );
                  if (unroomed.length === 0) return null;
                  return (
                    <div>
                      <h4 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                        <span className="text-muted-foreground">Комната:</span>
                        Без комнаты
                      </h4>
                      <div className="ml-2 space-y-1">
                        {unroomed.map((device) => (
                          <DeviceRow key={device.id} device={device} />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DeviceRow({ device }: { device: Device }) {
  const signal = getSignalLevel(device);
  const functions = getDeviceFunctions(device);
  const manufacturer = getManufacturer(device);

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0 text-xs">
      <span className="font-medium text-foreground min-w-0 flex-shrink-0 max-w-[200px] truncate">
        {device.name}
      </span>
      <span className="text-muted-foreground flex-shrink-0">|</span>
      <span className="text-muted-foreground flex-shrink-0 max-w-[180px] truncate" title={functions}>
        {functions}
      </span>
      <span className="text-muted-foreground flex-shrink-0">|</span>
      <span className="text-muted-foreground flex-shrink-0">
        {manufacturer}
      </span>
      <span className="text-muted-foreground flex-shrink-0">|</span>
      <span className={`${signal.color} flex-shrink-0 font-mono`}>
        {signal.value}
      </span>
      <span className={`${signal.color} flex-shrink-0`}>
        ({signal.label})
      </span>
    </div>
  );
}
