import { useState, useEffect } from "react";
import type { Device } from "@/lib/yandex";

export type SensorHistoryData = {
  temperature: number[];
  humidity: number[];
};

export type SensorHistory = Record<string, SensorHistoryData>;

export function useSensorHistory(devices?: Device[]) {
  const [history, setHistory] = useState<SensorHistory>({});

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem("sensor_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Update on new data
  useEffect(() => {
    if (!devices || devices.length === 0) return;
    
    setHistory((prev) => {
      const next = { ...prev };
      let changed = false;

      devices.forEach((device) => {
        if (device.type.includes("sensor")) {
          const tempProp = device.properties?.find(p => p.parameters?.instance === "temperature");
          const humProp = device.properties?.find(p => p.parameters?.instance === "humidity");
          
          if (!next[device.id]) {
            next[device.id] = { temperature: [], humidity: [] };
          }
          
          const hist = next[device.id];
          
          if (tempProp?.state?.value !== undefined) {
            const val = tempProp.state.value as number;
            if (hist.temperature[hist.temperature.length - 1] !== val) {
               hist.temperature.push(val);
               if (hist.temperature.length > 8) hist.temperature.shift();
               changed = true;
            }
          }

          if (humProp?.state?.value !== undefined) {
            const val = humProp.state.value as number;
            if (hist.humidity[hist.humidity.length - 1] !== val) {
               hist.humidity.push(val);
               if (hist.humidity.length > 8) hist.humidity.shift();
               changed = true;
            }
          }
        }
      });

      if (changed) {
        localStorage.setItem("sensor_history", JSON.stringify(next));
        return next;
      }
      return prev;
    });
  }, [devices]);

  return history;
}
