import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import { SmartCard, type CardSize } from "./SmartCard";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import { getDeviceIcon, getDeviceCapability, type Device } from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { Pin, PinOff, Maximize2, Minimize2, Trash2, ChevronUp, Square, ChevronDown } from "lucide-react";
import { LuxBar, LuxButton, LuxBadge, CardHeader, SmartCardDivider } from "./premium";

interface CurtainCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

export function CurtainCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: CurtainCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;
  const { menuState, handleLongPressStart, closeMenu } = useContextMenu();

  const positionCap = getDeviceCapability(device, "devices.capabilities.range", "open");
  const position = positionCap?.state?.value as number | undefined;
  const canStop = !!getDeviceCapability(device, "devices.capabilities.on_off");

  const contextMenuItems = [
    {
      id: "pin",
      label: isPinned ? "Открепить" : "Закрепить",
      icon: isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
      onClick: () => onPin?.(),
    },
    {
      id: "resize-expand",
      label: "Увеличить",
      icon: <Maximize2 className="w-4 h-4" />,
      onClick: () => onResize?.("2x1"),
    },
    {
      id: "resize-shrink",
      label: "Уменьшить",
      icon: <Minimize2 className="w-4 h-4" />,
      onClick: () => onResize?.("1x1"),
    },
    {
      id: "delete",
      label: "Скрыть",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => onDelete?.(),
      danger: true,
    },
  ];

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    handleLongPressStart(e, contextMenuItems);
  }, [contextMenuItems, handleLongPressStart]);

  const patchPosition = (value: number) => {
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.range" && c.state?.instance === "open"
                ? { ...c, state: { ...c.state, value } }
                : c
            ),
          };
        }),
      };
    });
  };

  const rollbackCurtain = (title: string) => {
    queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
    toast({ variant: "destructive", title: "Ошибка", description: title });
  };

  const handlePositionChange = (newPos: number) => {
    patchPosition(newPos);
    controlDevice.mutateAsync({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.range", state: { instance: "open", value: newPos } }] },
    }).catch(() => rollbackCurtain(`Не удалось изменить положение ${device.name}`));
  };

  const handleOpen = () => {
    patchPosition(100);
    controlDevice.mutateAsync({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.range", state: { instance: "open", value: 100 } }] },
    }).then(() => toast({ variant: "success", title: "Шторы открыты", description: device.name }))
      .catch(() => rollbackCurtain(`Не удалось открыть ${device.name}`));
  };

  const handleClose = () => {
    patchPosition(0);
    controlDevice.mutateAsync({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.range", state: { instance: "open", value: 0 } }] },
    }).then(() => toast({ variant: "success", title: "Шторы закрыты", description: device.name }))
      .catch(() => rollbackCurtain(`Не удалось закрыть ${device.name}`));
  };

  const handleStop = () => {
    if (!canStop) return;
    controlDevice.mutateAsync({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: false } }] },
    }).then(() => toast({ variant: "success", title: "Шторы остановлены", description: device.name }))
      .catch(() => rollbackCurtain(`Не удалось остановить ${device.name}`));
  };

  const open = position !== undefined && position > 0;

  return (
    <SmartCard
      size={size}
      variant="curtain"
      active={open}
      pinned={isPinned}
      onContextMenu={handleContextMenu}
      data-testid={`tile-device-${device.id}`}
    >
      <div className="h-full flex flex-col">
        {/* Заголовок всегда вверху слева */}
        <CardHeader
          icon={icon}
          name={device.name}
          on={open}
          size={size}
          labelOn="Открыто"
          labelOff="Закрыто"
          right={
            <LuxBadge variant={open ? "gold" : "muted"} active={open} className="shrink-0">
              {open ? `${Math.round(position!)}%` : "Закрыто"}
            </LuxBadge>
          }
        />
        <SmartCardDivider className="mt-2 mb-2" />

        {/* Контент по центру слота */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1.5">
          <div className="flex items-baseline gap-1">
            <span className={`font-bold text-foreground leading-none ${size === "compact" ? "text-base" : "text-xl"} ${open && "text-[#f3e5ab]"}`}>
              {position !== undefined ? `${Math.round(position)}%` : "—"}
            </span>
          </div>

          {/* Кнопки управления доступны всегда — штору можно открыть в любом состоянии */}
          <div className="w-full space-y-1.5">
            <div className="flex gap-2 w-full" onClick={(e) => e.stopPropagation()}>
              <LuxButton variant="gold" glow onClick={handleOpen} className="flex-1 py-1.5">
                <span className="flex items-center justify-center gap-1"><ChevronUp className="w-3 h-3" /> Открыть</span>
              </LuxButton>
              {canStop && (
                <LuxButton variant="quiet" onClick={handleStop} className="flex-1 py-1.5">
                  <span className="flex items-center justify-center gap-1"><Square className="w-2.5 h-2.5" /> Стоп</span>
                </LuxButton>
              )}
              <LuxButton variant="gold-ghost" onClick={handleClose} className="flex-1 py-1.5">
                <span className="flex items-center justify-center gap-1"><ChevronDown className="w-3 h-3" /> Закрыть</span>
              </LuxButton>
            </div>

            {/* Слайдер приглушается при закрытой шторе */}
            {position !== undefined && (
              <div className={`w-full transition-opacity duration-300 ${open ? "" : "opacity-30 pointer-events-none select-none"}`}>
                <LuxBar
                  value={position}
                  min={0}
                  max={100}
                  step={1}
                  label="Позиция"
                  display={(v) => `${Math.round(v)}%`}
                  onChange={handlePositionChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <ContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={menuState.items}
        onClose={closeMenu}
      />
    </SmartCard>
  );
}