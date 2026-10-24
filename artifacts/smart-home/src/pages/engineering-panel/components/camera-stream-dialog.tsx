import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  VideoOff,
  ExternalLink,
  Copy,
  Check,
  Radio,
  AlertTriangle,
} from "lucide-react";
import type { Device } from "@/lib/yandex";
import {
  analyzeCameraStream,
  classifyUrl,
  streamKindLabel,
  PLAYABLE_KINDS,
  type StreamCandidate,
} from "@/lib/camera-stream";

const RTSP_URLS_KEY = "camera_rtsp_urls";

function loadRtspUrls(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(RTSP_URLS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveRtspUrls(urls: Record<string, string>) {
  localStorage.setItem(RTSP_URLS_KEY, JSON.stringify(urls));
}

interface CameraStreamDialogProps {
  device: Device;
}

export function CameraStreamDialog({ device }: CameraStreamDialogProps) {
  const info = useMemo(() => analyzeCameraStream(device), [device]);
  const playable = info.candidates.find((c) => PLAYABLE_KINDS.has(c.kind));

  const isWhip =
    info.videoStreamCap?.protocol != null &&
    /whip|web_?rtc|webrtc/i.test(String(info.videoStreamCap.protocol));

  const [selectedUrl, setSelectedUrl] = useState<string | null>(playable?.url ?? null);
  const [rtspUrl, setRtspUrl] = useState(() => loadRtspUrls()[device.id] ?? "");
  const [rtspSaved, setRtspSaved] = useState(!!loadRtspUrls()[device.id]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [snapshotT, setSnapshotT] = useState(() => Date.now());

  // Auto-select first playable on open change
  useEffect(() => {
    setError(null);
    if (!selectedUrl) {
      const p = info.candidates.find((c) => PLAYABLE_KINDS.has(c.kind));
      setSelectedUrl(p?.url ?? null);
    }
  }, [info, selectedUrl]);

  const deviceIdForYandex = (device as any).quasar_info?.device_id ?? device.id;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const saveRtsp = () => {
    const urls = loadRtspUrls();
    if (rtspUrl.trim()) {
      urls[device.id] = rtspUrl.trim();
      saveRtspUrls(urls);
      setRtspSaved(true);
      setSelectedUrl(rtspUrl.trim());
      setError(null);
    } else {
      const u = loadRtspUrls();
      delete u[device.id];
      saveRtspUrls(u);
      setRtspSaved(false);
    }
  };

  const useCandidate = useCallback((c: StreamCandidate) => {
    setError(null);
    if (c.kind === "snapshot") setSnapshotT(Date.now());
    setSelectedUrl(c.url ?? null);
  }, []);

  const effectiveUrl = selectedUrl ?? (rtspSaved ? rtspUrl : null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="p-1.5 rounded-md bg-muted/50 hover:bg-red-500/20 hover:text-red-400 text-muted-foreground flex items-center justify-center transition-colors"
          title="Показать камеру"
        >
          <Video className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8 truncate">
            <span className="text-xl">{device.type.includes("camera") ? "📷" : "🎥"}</span>
            <span className="truncate">{device.name}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2">
          <div className="space-y-4">
            {/* Playback area */}
            <div>
              <div className="rounded-xl bg-black border border-border/30 overflow-hidden relative"
                style={{ minHeight: 220 }}
              >
                {effectiveUrl ? (
                  <div className="w-full h-full min-h-[220px] flex items-center justify-center relative">
                    {(() => {
                      const cand = classifyUrl(effectiveUrl, "selected");
                      if (!cand) return <span className="text-muted-foreground text-xs">Неизвестный формат</span>;
                      if (cand.kind === "snapshot" || cand.kind === "mjpeg" || cand.kind === "generic") {
                        return (
                          <img
                            key={snapshotT}
                            src={effectiveUrl + (cand.kind === "snapshot" ? (effectiveUrl.includes("?") ? "&" : "?") + `t=${snapshotT}` : "")}
                            alt={device.name}
                            className="w-full h-full min-h-[220px] object-contain"
                            onError={() => setError("Не удалось получить изображение с камеры.")}
                          />
                        );
                      }
                      return (
                        <video
                          key={effectiveUrl}
                          src={effectiveUrl}
                          autoPlay
                          muted
                          playsInline
                          controls
                          controlsList="nodownload"
                          className="w-full h-full min-h-[220px] object-contain"
                          onError={() => setError(
                            cand.kind === "hls"
                              ? "HLS-поток не играется в этом браузере (нужен Safari или hls.js). Попробуй открыть в Яндексе или настрой RTSP."
                              : cand.kind === "rtsp"
                                ? "RTSP не играется напрямую в браузере. Нужен локальный конвертер RTSP→HLS (ffmpeg) или VLC."
                                : "Не удалось воспроизвести поток."
                          )}
                        />
                      );
                    })()}
                    {isWhip && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 text-[10px] text-[hsl(var(--gold))]">
                        <Radio className="w-3 h-3" />
                        WHIP / WebRTC
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full min-h-[220px] flex flex-col items-center justify-center gap-3 text-center p-4">
                    <span className="text-4xl opacity-60">📷</span>
                    <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                      Автоматически найденных потоков нет. Если камера отдаёт RTSP/HLS — впиши URL ниже
                      (кнопка «Показать поток» подключается автоматически).
                    </p>
                    {isWhip && info.videoStreamCap && (
                      <p className="text-[11px] text-[hsl(var(--gold))]/80">
                        {info.videoStreamCap.protocol} — поток Яндекса показывается в приложении/на ТВ,
                        напрямую в браузере его не открыть.
                      </p>
                    )}
                    <a
                      href={`https://yandex.ru/smart/home/${device.household_id}/devices/${deviceIdForYandex}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Открыть в Яндексе
                    </a>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-[11px] text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* video_stream capability info */}
            {info.videoStreamCap && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Radio className="w-3 h-3" />
                  Капабилити video_stream
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {info.videoStreamCap.protocol && <Badge variant="outline" className="text-[10px]">протокол: {info.videoStreamCap.protocol}</Badge>}
                  {info.videoStreamCap.provider && <Badge variant="outline" className="text-[10px]">провайдер: {info.videoStreamCap.provider}</Badge>}
                  {info.videoStreamCap.profile && <Badge variant="outline" className="text-[10px]">профиль: {info.videoStreamCap.profile}</Badge>}
                  {info.videoStreamCap.instance && <Badge variant="outline" className="text-[10px]">instance: {info.videoStreamCap.instance}</Badge>}
                </div>
                {isWhip && (
                  <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                    Яндекс раздаёт стрим по протоколу WHIP (WebRTC). Для воспроизведения нужен клиент,
                    который получит SDP-сессию. Готовый способ — «Открыть в Яндексе».
                  </p>
                )}
              </div>
            )}

            {/* RTSP manual config */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <VideoOff className="w-3 h-3" />
                Ручной поток (RTSP/HLS/снимок)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rtspUrl}
                  onChange={(e) => { setRtspUrl(e.target.value); setRtspSaved(false); }}
                  placeholder="rtsp://login:pass@ip:554/stream или https://.../index.m3u8"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-background text-xs font-mono"
                />
                <button
                  onClick={saveRtsp}
                  className="shrink-0 px-3 py-2 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {rtspSaved ? "Обновить" : "Показать поток"}
                </button>
              </div>
              {rtspSaved ? (
                <p className="text-[10px] text-[hsl(var(--gold))]">
                  RTSP сохранён для этой камеры — настройка общая с юзер-панелью.
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  RTSP-адрес пригодится, когда камера доступна в локальной сети. Прямо в браузере RTSP не
                  играется — для этого нужен ffmpeg-конвертер в HLS (можно добавить на бэкенд).
                </p>
              )}
            </div>

            {/* Found URLs */}
            {info.candidates.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Найденные ссылки ({info.candidates.length})
                </p>
                <div className="space-y-1.5">
                  {info.candidates.map((c, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors ${
                        selectedUrl === c.url
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/40 bg-muted/20"
                      }`}
                    >
                      <Badge variant={selectedUrl === c.url ? "default" : "secondary"} className="text-[9px] shrink-0">
                        {streamKindLabel(c.kind)}
                      </Badge>
                      <span className="flex-1 min-w-0 text-[10px] font-mono text-muted-foreground truncate" title={c.url}>
                        {c.url}
                      </span>
                      <button
                        onClick={() => useCandidate(c)}
                        disabled={!c.url}
                        className={`shrink-0 px-2 py-1 rounded-md text-[10px] transition-colors ${
                          selectedUrl === c.url
                            ? "bg-primary/20 text-primary"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        }`}
                        title="Использовать эту ссылку"
                      >
                        <Play mini />
                      </button>
                      <button
                        onClick={() => c.url && copy(c.url, c.key)}
                        className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        title="Скопировать"
                      >
                        {copied === c.key ? <Check className="w-3 h-3 text-[hsl(var(--gold))]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nothing found notice */}
            {info.candidates.length === 0 && !isWhip && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-[11px] text-muted-foreground">
                <VideoOff className="w-3.5 h-3.5 shrink-0" />
                В данных API нет ссылок на поток. Скорее всего, стрим доступен только через инфраструктуру Яндекса —
                используй «Открыть в Яндексе» или задай RTSP вручную.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Play({ mini }: { mini?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={mini ? "w-3 h-3" : "w-4 h-4"}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}