import { createContext, useContext } from "react";
import type { Device } from "@/lib/yandex";

export interface DeviceSettingsTarget {
  device: Device;
  token: string;
}

const DeviceSettingsContext = createContext<DeviceSettingsTarget | null>(null);

export function DeviceSettingsProvider({
  device,
  token,
  children,
}: DeviceSettingsTarget & { children: React.ReactNode }) {
  return (
    <DeviceSettingsContext.Provider value={{ device, token }}>
      {children}
    </DeviceSettingsContext.Provider>
  );
}

export function useDeviceSettingsTarget(): DeviceSettingsTarget | null {
  return useContext(DeviceSettingsContext);
}
