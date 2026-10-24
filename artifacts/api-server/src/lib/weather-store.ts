/**
 * Кэш последнего успешного ответа погодного сервиса.
 * Движок сценариев использует наружную температуру из этого кэша,
 * не попадая под рейт-лимиты погодного API.
 */

export interface WeatherSnapshot {
  temperature_2m: number;
  relative_humidity_2m: number;
  weather_code: number;
  updated_at: number;
}

let lastWeather: WeatherSnapshot | null = null;

export function setLastWeather(snapshot: WeatherSnapshot): void {
  lastWeather = snapshot;
}

export function getLastWeather(): WeatherSnapshot | null {
  return lastWeather;
}