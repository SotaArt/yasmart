import { useState, useEffect, useCallback } from "react";
import {
  getSensorInversions,
  isSensorInverted,
  setSensorInversion,
  subscribeToInversions,
  INVERTIBLE_INSTANCES,
  type InvertibleInstance,
} from "@/lib/sensor-inversions-store";

export function useSensorInversions() {
  const [, setVersion] = useState(0);

  useEffect(() => subscribeToInversions(() => setVersion((v) => v + 1)), []);

  const isInverted = useCallback(
    (deviceId: string, instance: InvertibleInstance): boolean => isSensorInverted(deviceId, instance),
    []
  );

  const setInverted = useCallback((deviceId: string, instance: InvertibleInstance, invert: boolean) => {
    setSensorInversion(deviceId, instance, invert);
  }, []);

  const toggleInverted = useCallback((deviceId: string, instance: InvertibleInstance) => {
    setSensorInversion(deviceId, instance, !getSensorInversions(deviceId).has(instance));
  }, []);

  return { isInverted, setInverted, toggleInverted, instances: INVERTIBLE_INSTANCES };
}