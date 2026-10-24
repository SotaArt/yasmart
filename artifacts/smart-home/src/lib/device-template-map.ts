import type { Device } from "@/lib/yandex";

/** Соответствие шаблонов типам устройств из API (единый источник для каталога и ЮП) */
export function matchDeviceToTemplate(device: Device): string | null {
  const type = device.type;

  // Выключатели
  if (type === "devices.types.switch" || type === "devices.types.switch.relay") return "switch";
  if (type === "devices.types.socket") return "socket";

  // Освещение
  if (type.startsWith("devices.types.light")) {
    if (type === "devices.types.light.strip") return "light-strip";
    const hasBrightness = device.capabilities?.some(c =>
      c.type === "devices.capabilities.range" && c.state?.instance === "brightness"
    );
    const hasColor = device.capabilities?.some(c =>
      c.type === "devices.capabilities.color" ||
      c.type === "devices.capabilities.color_setting"
    );
    const hasColorTemp = device.capabilities?.some(c =>
      c.type === "devices.capabilities.range" && c.state?.instance === "color_temperature"
    );
    if (hasColor && hasColorTemp) return "light-full";
    if (hasColor) return "light-color";
    if (hasColorTemp) return "light-temp";
    if (hasBrightness) return "light-dimmer";
    return "light-onoff";
  }

  // Климат
  if (type === "devices.types.thermostat.ac") return "ac";
  if (type === "devices.types.thermostat") return "thermostat";
  if (type === "devices.types.thermostat.heater") return "heater";
  if (type === "devices.types.humidifier") return "humidifier";
  if (type === "devices.types.purifier") return "purifier";
  if (type === "devices.types.ventilation" || type === "devices.types.ventilation.fan") return "fan";
  if (type === "devices.types.cooking.hood") return "hood";

  // Шторы
  if (type === "devices.types.openable.curtain") return "curtain";
  if (type === "devices.types.openable.valve") return "valve";
  if (type === "devices.types.openable.door_lock") return "lock";

  // Медиа
  if (type === "devices.types.media_device.tv") return "tv";
  if (type.includes("speaker") || type.includes("station")) return "speaker";
  if (type.startsWith("devices.types.media_device")) return "media";

  // Датчики
  if (type === "devices.types.sensor.water_leak") return "sensor-leak";
  if (type === "devices.types.sensor.motion") return "sensor-motion";
  if (type === "devices.types.sensor.presence") return "sensor-presence";
  if (type === "devices.types.sensor.open") return "sensor-door";
  if (type === "devices.types.sensor.vibration") return "sensor-vibration";
  if (type === "devices.types.sensor.smoke") return "sensor-smoke";
  if (type === "devices.types.sensor.gas") return "sensor-gas";
  if (type === "devices.types.sensor.illumination") return "sensor-illumination";
  if (type === "devices.types.sensor.button") return "sensor-button";
  if (type === "devices.types.sensor.climate") return "sensor-climate";
  if (type === "devices.types.sensor") return "sensor-temp";
  // IR-пульты (devices.types.remote.ir) отдают температуру и влажность
  if (type === "devices.types.remote.ir") return "sensor-climate";

  // Камеры
  if (type === "devices.types.camera") return "camera";

  // Бытовая техника
  if (type === "devices.types.vacuum_cleaner") return "vacuum";
  if (type === "devices.types.washing_machine") return "washer";
  if (type === "devices.types.dishwasher") return "dishwasher";
  if (type === "devices.types.cooking.kettle") return "kettle";
  if (type === "devices.types.cooking.coffee_maker") return "coffeemaker";
  if (type === "devices.types.cooking.multicooker") return "multicooker";
  if (type === "devices.types.iron") return "iron";

  // Счётчики
  if (type === "devices.types.smart_meter.cold_water" || type === "devices.types.smart_meter.hot_water") return "meter-water";
  if (type === "devices.types.smart_meter.electricity") return "meter-electricity";
  if (type === "devices.types.smart_meter.gas") return "meter-gas";

  return null;
}