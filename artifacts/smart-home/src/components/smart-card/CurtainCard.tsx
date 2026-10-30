import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { ContextMenu, useContextMenu } from "@/components/ContextMenu";
import { getDeviceIcon, getDeviceCapability, type Device } from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";
import type { TileSize } from "@/hooks/use-panel-config";
import { Pin, PinOff, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { CardFrame, CardMetric } from "./premium";

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

  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;
  const { menuState, handleLongPressStart, closeMenu } = useContextMenu();

  const positionCap = getDeviceCapability(device, "devices.capabilities.range", "open");
  const position = positionCap?.state?.value as number | undefined;

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

  const open = position !== undefined && position > 0;

  return (
    <CardFrame
      size={size}
      variant="curtain"
      active={open}
      pinned={isPinned}
      onContextMenu={handleContextMenu}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      labelOn="Открыто"
      labelOff="Закрыто"
      metric={
        position !== undefined ? (
          <CardMetric value={`${Math.round(position)}%`} label="положение" />
        ) : undefined
      }
      power={{
        on: open,
        onChange: (next) => (next ? handleOpen() : handleClose()),
        label: device.name,
      }}
      timer
      overlay={
        <ContextMenu
          open={menuState.open}
          x={menuState.x}
          y={menuState.y}
          items={menuState.items}
          onClose={closeMenu}
        />
      }
    />
  );
}
