import { useState, useEffect, useRef } from "react";
import { SmartCard, type CardSize } from "./SmartCard";
import { SmartCardDivider } from "./premium";
import { getDeviceIcon, getDeviceCapability, type Device } from "@/lib/yandex";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import { deviceCommandQueue } from "@/lib/command-queue";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { TileSize } from "@/hooks/use-panel-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Settings,
  X,
} from "lucide-react";

const RTSP_CONFIG_KEY = "camera_rtsp_urls";

interface CameraCardProps {
  device: Device;
  token: string;
  size: CardSize;
  tileConfig?: { size?: TileSize; pinned?: boolean; compact?: boolean };
  onPin?: () => void;
  onDelete?: () => void;
  onResize?: (size: TileSize) => void;
  onToggleCompact?: () => void;
}

function getCameraState(device: Device): "online" | "offline" | "error" {
  const status = (device as any).status;
  if (status === "online") return "online";
  if (status === "error") return "error";
  return "offline";
}

function getPropertyValue(device: Device, instance: string): string | number | boolean | undefined {
  const prop = (device.properties ?? []).find(
    (p) => p.parameters?.instance === instance && p.state?.value !== undefined
  );
  return prop?.state?.value as string | number | boolean | undefined;
}

function getMotionState(device: Device): boolean {
  const motion = getPropertyValue(device, "motion");
  return motion === "detected" || motion === true;
}

function getHumanState(device: Device): boolean {
  const human = getPropertyValue(device, "video_detection");
  return human === "human_present" || human === true;
}

function getNoiseState(device: Device): boolean {
  const noise = getPropertyValue(device, "noise");
  return noise !== undefined && noise !== "unidentified";
}

function getResolutionLabel(device: Device): string {
  const cap = getDeviceCapability(device, "devices.capabilities.mode", "video_resolution");
  const value = cap?.state?.value as string | undefined;
  const modes = cap?.parameters?.modes as Array<{ value: string; name: string }> | undefined;

  if (!value || !modes) return "—";
  const mode = modes.find((m) => m.value === value);
  return mode?.name ?? value.replace("video_resolution_", "").toUpperCase();
}

function getMuteState(device: Device): boolean {
  const cap = getDeviceCapability(device, "devices.capabilities.toggle", "camera_sw_mute");
  return cap?.state?.value === true;
}

function getHardwareMuteState(device: Device): string {
  const value = getPropertyValue(device, "camera_hw_mute");
  return value === "hw_mute_enabled" ? "Выкл" : "Вкл";
}

function loadRtspUrls(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(RTSP_CONFIG_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveRtspUrls(urls: Record<string, string>) {
  localStorage.setItem(RTSP_CONFIG_KEY, JSON.stringify(urls));
}

export function CameraCard({
  device,
  token,
  size,
  tileConfig,
  onPin,
  onDelete,
  onResize,
  onToggleCompact,
}: CameraCardProps) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const icon = getDeviceIcon(device.type, device.id);
  const isPinned = tileConfig?.pinned ?? false;
  const cameraState = getCameraState(device);
  const hasMotion = getMotionState(device);
  const hasHuman = getHumanState(device);
  const hasNoise = getNoiseState(device);
  const isDetecting = hasMotion || hasHuman || hasNoise;

  const resolution = getResolutionLabel(device);
  const isMuted = getMuteState(device);
  const hwMute = getHardwareMuteState(device);

  const [showStream, setShowStream] = useState(false);
  const [showRtspConfig, setShowRtspConfig] = useState(false);
  const [rtspUrl, setRtspUrl] = useState(() => {
    const urls = loadRtspUrls();
    return urls[device.id] ?? "";
  });
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasVideoStream = device.capabilities?.some(
    (c) => c.type === "devices.capabilities.video_stream"
  );

  const hasPtz = device.capabilities?.some(
    (c) => c.type === "devices.capabilities.range" &&
      (c.parameters?.instance === "camera_pan" || c.parameters?.instance === "camera_tilt")
  );

  const lastCommandAt = useRef(0);

  const sendCommand = (actions: any[]) => {
    const now = Date.now();
    if (now - lastCommandAt.current < 300) return;
    lastCommandAt.current = now;
    deviceCommandQueue.add(() =>
      controlDevice.mutateAsync({
        deviceId: device.id,
        data: { actions },
      })
    ).then(() => queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }))
      .catch(() => {
        queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        toast({ variant: "destructive", title: "Ошибка", description: `Не удалось выполнить команду для ${device.name}` });
      });
  };

  const toggleMute = () => {
    sendCommand([{
      type: "devices.capabilities.toggle",
      state: { instance: "camera_sw_mute", value: !isMuted }
    }]);
  };

  const ptzMove = (instance: string, direction: number) => {
    sendCommand([{
      type: "devices.capabilities.range",
      state: { instance, value: direction > 0 ? 100 : 0 }
    }]);
  };

  const saveRtsp = () => {
    const urls = loadRtspUrls();
    if (rtspUrl.trim()) {
      urls[device.id] = rtspUrl.trim();
    } else {
      delete urls[device.id];
    }
    saveRtspUrls(urls);
    setShowRtspConfig(false);
  };

  const openInYandex = () => {
    const deviceId = (device as any).quasar_info?.device_id ?? device.id;
    window.open(`https://yandex.ru/smart/home/${device.household_id}/devices/${deviceId}`, "_blank");
  };

  // Cleanup video on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.src = "";
      }
    };
  }, []);

  return (
    <SmartCard
      size={size}
      variant={isDetecting ? "security" : "sensor"}
      active={cameraState === "online"}
      pinned={isPinned}
      data-testid={`tile-device-${device.id}`}
    >
      <SmartCard.Header
        icon={icon}
        name={device.name}
        connection={cameraState === "online" ? "online" : cameraState === "error" ? "error" : "offline"}
      />
      <SmartCardDivider className="mt-2 mb-2" />

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
      {/* Compact: status + detection indicator */}
      {size === "compact" && (
        <>
          <SmartCard.Primary>
            {isDetecting ? "Тревога" : cameraState === "online" ? "Онлайн" : "Оффлайн"}
          </SmartCard.Primary>
          {isDetecting && (
            <div className="mt-1 flex gap-1">
              {hasMotion && <span className="text-[9px] px-1 py-0.5 rounded bg-device-error/10 text-device-error">🏃</span>}
              {hasHuman && <span className="text-[9px] px-1 py-0.5 rounded bg-device-error/10 text-device-error">👤</span>}
            </div>
          )}
        </>
      )}

      {/* Standard: status + preview + controls */}
      {size === "standard" && (
        <>
          <SmartCard.Primary>
            {isDetecting ? "Тревога" : cameraState === "online" ? "Онлайн" : "Оффлайн"}
          </SmartCard.Primary>

          {/* Preview area */}
          <div className="mt-2 rounded-lg bg-muted/30 border border-border/30 h-16 flex items-center justify-center relative overflow-hidden">
            {rtspUrl ? (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                RTSP сконфигурирован
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Превью</span>
            )}
            {isDetecting && (
              <div className="absolute top-1 right-1">
                <span className="w-2 h-2 rounded-full bg-device-error animate-pulse" />
              </div>
            )}
          </div>

          {/* Quick controls */}
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {hasPtz && (
              <div className="flex gap-0.5">
                <button
                  onClick={() => ptzMove("camera_pan", -1)}
                  className="w-5 h-5 rounded bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  title="Влево"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={() => ptzMove("camera_pan", 1)}
                  className="w-5 h-5 rounded bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  title="Вправо"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => ptzMove("camera_tilt", -1)}
                  className="w-5 h-5 rounded bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  title="Вверх"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => ptzMove("camera_tilt", 1)}
                  className="w-5 h-5 rounded bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  title="Вниз"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}
            <button
              onClick={toggleMute}
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                isMuted
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary"
              }`}
              title={isMuted ? "Включить звук" : "Выключить звук"}
            >
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </button>
            <button
              onClick={openInYandex}
              className="w-5 h-5 rounded bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              title="Открыть в Яндексе"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Detection badges */}
          {isDetecting && (
            <div className="mt-1 flex gap-1 flex-wrap">
              {hasMotion && <span className="text-[9px] px-1 py-0.5 rounded bg-device-error/10 text-device-error">🏃 Движение</span>}
              {hasHuman && <span className="text-[9px] px-1 py-0.5 rounded bg-device-error/10 text-device-error">👤 Человек</span>}
              {hasNoise && <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400">🔊 Шум</span>}
            </div>
          )}

          {/* Resolution + mute status */}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{resolution}</span>
            <span>·</span>
            <span>Мик: {hwMute}</span>
          </div>
        </>
      )}

      {/* Expanded/Full: full camera view */}
      {(size === "expanded" || size === "full") && (
        <>
          <SmartCard.Primary>
            {isDetecting ? "Тревога" : cameraState === "online" ? "Онлайн" : "Оффлайн"}
          </SmartCard.Primary>

          {/* Video preview / RTSP stream */}
          <div className="mt-2 rounded-lg bg-muted/30 border border-border/30 overflow-hidden relative"
            style={{ minHeight: size === "full" ? "200px" : "120px" }}
          >
            {showStream && rtspUrl ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  src={rtspUrl}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  onError={() => setShowStream(false)}
                />
                <button
                  onClick={() => setShowStream(false)}
                  className="absolute top-1 right-1 w-6 h-6 rounded bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                {rtspUrl ? (
                  <button
                    onClick={() => setShowStream(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Включить видео
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRtspConfig(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground text-xs transition-colors"
                  >
                    <VideoOff className="w-3.5 h-3.5" />
                    Настроить RTSP
                  </button>
                )}
              </div>
            )}
            {isDetecting && (
              <div className="absolute top-1 right-1">
                <span className="w-2.5 h-2.5 rounded-full bg-device-error animate-pulse" />
              </div>
            )}
          </div>

          {/* PTZ Controls */}
          {hasPtz && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => ptzMove("camera_tilt", -1)}
                className="w-7 h-7 rounded-lg bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                title="Вверх"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <div className="flex gap-1">
                <button
                  onClick={() => ptzMove("camera_pan", -1)}
                  className="w-7 h-7 rounded-lg bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  title="Влево"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => ptzMove("camera_tilt", 1)}
                  className="w-7 h-7 rounded-lg bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  title="Вниз"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => ptzMove("camera_pan", 1)}
                  className="w-7 h-7 rounded-lg bg-muted/50 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  title="Вправо"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Quick controls row */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleMute}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                isMuted
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted border border-border/30"
              }`}
            >
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              {isMuted ? "Звук выкл" : "Звук вкл"}
            </button>
            <button
              onClick={openInYandex}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-muted/50 text-muted-foreground hover:bg-muted border border-border/30 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Яндекс
            </button>
            <button
              onClick={() => setShowRtspConfig(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-muted/50 text-muted-foreground hover:bg-muted border border-border/30 transition-colors"
            >
              <Settings className="w-3 h-3" />
              RTSP
            </button>
          </div>

          {/* Detection indicators */}
          {isDetecting && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {hasMotion && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-device-error/10 border border-device-error/30">
                  <span className="text-xs">🏃</span>
                  <span className="text-[10px] font-medium text-device-error">Движение</span>
                </div>
              )}
              {hasHuman && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-device-error/10 border border-device-error/30">
                  <span className="text-xs">👤</span>
                  <span className="text-[10px] font-medium text-device-error">Человек</span>
                </div>
              )}
              {hasNoise && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <span className="text-xs">🔊</span>
                  <span className="text-[10px] font-medium text-yellow-400">Шум</span>
                </div>
              )}
            </div>
          )}

          {/* Camera info */}
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${cameraState === "online" ? "bg-[hsl(var(--gold))]" : "bg-muted-foreground"}`} />
            <span>{resolution}</span>
            <span>·</span>
            <span>Мик: {hwMute}</span>
            {hasVideoStream && (
              <>
                <span>·</span>
                <span className="text-[hsl(var(--gold))]">WHIP</span>
              </>
            )}
          </div>
        </>
      )}

      </div>

      {/* RTSP Config Dialog */}
      <Dialog open={showRtspConfig} onOpenChange={setShowRtspConfig}>
        <DialogContent className="sm:max-w-md p-4">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-sm font-semibold">RTSP URL — {device.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Введите RTSP URL вашей камеры для прямого просмотра видео.
            Формат: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">rtsp://login:password@ip:554/stream</code>
          </p>
          <input
            type="text"
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
            placeholder="rtsp://login:password@ip:554/stream"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowRtspConfig(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={saveRtsp}
              className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Сохранить
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </SmartCard>
  );
}
