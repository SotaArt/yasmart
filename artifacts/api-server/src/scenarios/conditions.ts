/**
 * Оценка дерева условий сценария.
 * Гибкие условия: И/ИЛИ/НЕ, сравнения с гистерезисом, время, дни недели,
 * режим дома, состояние устройства, наличие данных.
 */

import type { Condition, HomeMode, NumericOp, ValueSource } from "./types";
import type { DeviceMap } from "./device-state";
import { getMode, getOnOff, resolveValue, getReading } from "./device-state";
import { getLastWeather } from "../lib/weather-store";

export interface ConditionCtx {
  presence: HomeMode;
  devices: DeviceMap;
  roomTemp?: number;
  supplyTemp?: number;
}

/** гистерезис: включает/выключает по двум порогам */
function compareWithHysteresis(
  value: number | undefined,
  op: string,
  threshold: number,
  hysteresis: number | undefined,
  state: { active: boolean }
): boolean {
  if (value === undefined) return false;
  const h = hysteresis ?? 0;
  if (h > 0 && op === "lt") {
    // включаем ниже порога, выключаем не раньше чем вернулись выше порога+h
    if (state.active) return value < threshold + h;
    return value < threshold;
  }
  if (h > 0 && op === "gt") {
    if (state.active) return value > threshold - h;
    return value > threshold;
  }
  if (h > 0 && op === "lte") {
    if (state.active) return value <= threshold + h;
    return value <= threshold;
  }
  if (h > 0 && op === "gte") {
    if (state.active) return value >= threshold - h;
    return value >= threshold;
  }
  switch (op) {
    case "lt": return value < threshold;
    case "lte": return value <= threshold;
    case "gt": return value > threshold;
    case "gte": return value >= threshold;
    case "eq": return Math.abs(value - threshold) < 1e-6;
    case "ne": return Math.abs(value - threshold) >= 1e-6;
    default: return false;
  }
}

function evalValueSource(
  source: { source: ValueSource; op: NumericOp; value: number; hysteresis?: number },
  devices: DeviceMap,
  ctx: ConditionCtx
): number | undefined {
  if (source.source.kind === "room_temp") return ctx.roomTemp;
  if (source.source.kind === "supply_temp") return ctx.supplyTemp;
  if (source.source.kind === "outdoor_temp") return getLastWeather()?.temperature_2m;
  return resolveValue(source.source, devices, {
    roomTemp: ctx.roomTemp,
    outdoorTemp: getLastWeather()?.temperature_2m,
    supplyTemp: ctx.supplyTemp,
  });
}

function evalCondition(
  cond: Condition,
  ctx: ConditionCtx,
  states: Map<string, { active: boolean }>
): boolean {
  switch (cond.type) {
    case "true":
      return true;
    case "and": {
      for (const c of cond.children) {
        if (!evalCondition(c, ctx, states)) return false;
      }
      return true;
    }
    case "or": {
      for (const c of cond.children) {
        if (evalCondition(c, ctx, states)) return true;
      }
      return false;
    }
    case "not":
      return !evalCondition(cond.child, ctx, states);
    case "compare": {
      const value = evalValueSource(cond, ctx.devices, ctx);
      const stateKey = `${cond.source.kind}:${("device" in cond.source ? cond.source.device : "")}:${cond.op}:${cond.value}`;
      const st = states.get(stateKey) ?? { active: false };
      const result = compareWithHysteresis(value, cond.op, cond.value, cond.hysteresis, st);
      st.active = result;
      states.set(stateKey, st);
      return result;
    }
    case "device_on":
      return getOnOff(ctx.devices.devices.get(cond.device)) === true;
    case "device_off":
      return getOnOff(ctx.devices.devices.get(cond.device)) === false;
    case "mode":
      return getMode(ctx.devices.devices.get(cond.device)) === cond.value;
    case "time_between": {
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const [fh, fm] = cond.from.split(":").map((s) => parseInt(s, 10) || 0);
      const [th, tm] = cond.to.split(":").map((s) => parseInt(s, 10) || 0);
      let fromMin = fh * 60 + fm;
      let toMin = th * 60 + tm;
      if (fromMin === toMin) return false;
      if (fromMin < toMin) return cur >= fromMin && cur < toMin;
      // переход через полночь
      return cur >= fromMin || cur < toMin;
    }
    case "weekday_in": {
      const dow = new Date().getDay(); // 0 = ВС
      return cond.days.includes(dow);
    }
    case "home_mode":
      return ctx.presence === cond.value;
    case "sensor_available": {
      if (cond.source === "capability") {
        const dev = ctx.devices.devices.get(cond.device);
        return !!dev?.capabilities.find(
          (c) => c.type === cond.capType && (cond.instance === undefined || c.instance === cond.instance)
        );
      }
      const dev = ctx.devices.devices.get(cond.device);
      return typeof getReading(dev, cond.instance ?? "temperature") === "number";
    }
    default:
      return false;
  }
}

export function evaluateConditions(
  cond: Condition,
  ctx: ConditionCtx,
  states: Map<string, { active: boolean }> = new Map()
): boolean {
  return evalCondition(cond, ctx, states);
}

/** Форматированное описание условия для UI/логов */
export function describeCondition(cond: Condition): string {
  switch (cond.type) {
    case "true": return "всегда";
    case "and": return cond.children.map(describeCondition).join(" и ");
    case "or": return cond.children.map(describeCondition).join(" или ");
    case "not": return `не (${describeCondition(cond.child)})`;
    case "compare": {
      const src = cond.source;
      const label =
        src.kind === "room_temp" ? "температура в комнате"
        : src.kind === "outdoor_temp" ? "наружная температура"
        : src.kind === "supply_temp" ? "температура притока"
        : src.kind === "constant" ? String(src.value)
        : "значение";
      const opLabel: Record<string, string> = { lt: "<", lte: "≤", gt: ">", gte: "≥", eq: "=", ne: "≠" };
      return `${label} ${opLabel[cond.op]} ${cond.value}`;
    }
    case "device_on": return `устройство включено`;
    case "device_off": return `устройство выключено`;
    case "mode": return `режим = ${cond.value}`;
    case "time_between": return `время ${cond.from}-${cond.to}`;
    case "weekday_in": return `дни ${cond.days.join(",")}`;
    case "home_mode": return `режим дома ${cond.value}`;
    case "sensor_available": return `данные датчика доступны`;
    default: return "?";
  }
}