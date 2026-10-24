export type CardSize = "compact" | "standard" | "expanded" | "full";

export type DeviceVariant =
  | "toggle"
  | "sensor"
  | "climate"
  | "thermostat"
  | "curtain"
  | "media"
  | "vacuum"
  | "security"
  | "scene";

export interface SmartCardContextValue {
  size: CardSize;
  variant: DeviceVariant;
  active: boolean;
  isDragging?: boolean;
}

export interface SmartCardHeaderProps {
  icon: string;
  name: string;
  room?: string;
  connection?: "online" | "offline" | "error";
}

export interface SmartCardPrimaryProps {
  children: React.ReactNode;
  accent?: boolean;
}

export interface SmartCardControlsProps {
  children: React.ReactNode;
}

export interface SmartCardMetaProps {
  children: React.ReactNode;
}

export interface SmartCardStatusProps {
  children: React.ReactNode;
}
