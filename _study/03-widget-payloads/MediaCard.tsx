import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import type { CardSize } from "./SmartCard";
import { getDeviceIcon, isDeviceOn, getDeviceCapability, type Device } from "@/lib/yandex";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import type { TileSize } from "@/hooks/use-panel-config";
import { LuxButton, LuxBar, CardFrame } from "./premium";


interface MediaCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

export function MediaCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: MediaCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type);
  const isPinned = tileConfig?.pinned ?? false;

  const playbackCap = getDeviceCapability(device, "devices.capabilities.mode", "playback");
  const hasPlayback = !!playbackCap;
  const isPlaying = playbackCap?.state?.value === "playing";

  const volumeCap = getDeviceCapability(device, "devices.capabilities.range", "volume");
  const hasVolume = !!volumeCap;
  const volume = (volumeCap?.state?.value as number) ?? 50;

  const handlePowerToggle = () => {
    const newValue = !isOn;
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.on_off"
                ? { ...c, state: { ...(c.state ?? {}), value: newValue } }
                : c
            ),
          };
        }),
      };
    });
    deviceCommandQueue.add(() =>
      controlDevice.mutateAsync({
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: newValue } }] },
      })
    ).then(() => {
      toast({ variant: "success", title: newValue ? "Медиа включён" : "Медиа выключен", description: device.name });
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
    });
  };

  const handlePlayback = (action: "play" | "pause" | "next" | "prev") => {
    const value =
      action === "next" ? "next_track" :
      action === "prev" ? "prev_track" :
      action;
    deviceCommandQueue.add(() =>
      controlDevice.mutateAsync({
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.mode", state: { instance: "playback", value } }] },
      })
    ).catch(() => {
      queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
    });
  };

  const handleVolumeChange = (newVol: number) => {
    queryClient.setQueryData(getUserInfoKey(token), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.range" && c.state?.instance === "volume"
                ? { ...c, state: { ...c.state, value: newVol } }
                : c
            ),
          };
        }),
      };
    });
    controlDevice.mutate({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.range", state: { instance: "volume", value: newVol } }] },
    });
  };

  return (
    <CardFrame
      size={size}
      variant="media"
      active={isOn}
      pinned={isPinned}
      dataTestId={`tile-device-${device.id}`}
      icon={icon}
      name={device.name}
      power={{ on: isOn, onChange: handlePowerToggle, label: device.name }}
      timer
      top={
        <div className="flex items-baseline gap-1">
          <span className={`font-bold text-foreground leading-none ${size === "compact" ? "text-base" : "text-xl"} ${isOn && "text-[#f3e5ab]"}`}>
            {isOn ? (isPlaying ? "Воспроизведение" : "Пауза") : "Выкл"}
          </span>
        </div>
      }
      bottom={
        <div className={`w-full space-y-1.5 transition-opacity duration-300 ${isOn ? "" : "opacity-30 pointer-events-none select-none"}`}>
          {hasPlayback && size !== "compact" && (
            <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
              <LuxButton variant="quiet" onClick={() => handlePlayback("prev")} className="w-9 h-9 flex items-center justify-center !p-0">
                <SkipBack className="w-3.5 h-3.5" />
              </LuxButton>
              <LuxButton
                variant={isPlaying ? "gold" : "action"}
                glow={isPlaying}
                onClick={() => handlePlayback(isPlaying ? "pause" : "play")}
                className="w-10 h-10 flex items-center justify-center !p-0"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </LuxButton>
              <LuxButton variant="quiet" onClick={() => handlePlayback("next")} className="w-9 h-9 flex items-center justify-center !p-0">
                <SkipForward className="w-3.5 h-3.5" />
              </LuxButton>
            </div>
          )}

          {hasVolume && (size === "expanded" || size === "full") && (
            <div className="w-full">
              <LuxBar
                value={volume}
                min={0}
                max={100}
                step={1}
                label="Громкость"
                display={(v) => `${Math.round(v)}%`}
                onChange={handleVolumeChange}
              />
            </div>
          )}
        </div>
      }
    />
  );
}
