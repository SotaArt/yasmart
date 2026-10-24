import type { Device } from "@/lib/yandex";

export type StreamKind =
  | "video_stream_cap"
  | "hls"
  | "mp4"
  | "webm"
  | "snapshot"
  | "mjpeg"
  | "rtsp"
  | "rtmp"
  | "ws"
  | "generic";

export interface StreamCandidate {
  kind: StreamKind;
  key: string;
  url?: string;
}

export interface CameraStreamInfo {
  candidates: StreamCandidate[];
  videoStreamCap?: {
    instance?: string;
    protocol?: string;
    provider?: string;
    profile?: string;
    value?: unknown;
  };
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i;
const SNAPSHOT_HINT_RE = /snapshot|thumb|preview|frame|image|capture/i;

/** Определяет тип ссылки по её формату */
export function classifyUrl(url: string, key: string): StreamCandidate | null {
  const lower = url.trim().toLowerCase();
  if (!lower) return null;
  if (/^rtsp:\/\//i.test(lower)) return { kind: "rtsp", key, url: url.trim() };
  if (/^rtmp:\/\//i.test(lower)) return { kind: "rtmp", key, url: url.trim() };
  if (/^wss?:\/\//i.test(lower)) return { kind: "ws", key, url: url.trim() };
  if (lower.includes(".m3u8")) return { kind: "hls", key, url: url.trim() };
  if (lower.includes("multipart") || /\.mjpg/i.test(lower)) return { kind: "mjpeg", key, url: url.trim() };
  if (/\.(mp4|m4v)(\?.*)?$/i.test(lower)) return { kind: "mp4", key, url: url.trim() };
  if (/\.(webm|ogg|ogv)(\?.*)?$/i.test(lower)) return { kind: "webm", key, url: url.trim() };
  if (/^https?:\/\//i.test(lower)) {
    if (IMAGE_RE.test(lower) || SNAPSHOT_HINT_RE.test(lower)) return { kind: "snapshot", key, url: url.trim() };
    return { kind: "generic", key, url: url.trim() };
  }
  return null;
}

const SKIP_KEYS = new Set(["id", "device_id", "skill_id", "external_id", "name", "type", "model", "manufacturer", "sw_version", "hw_version", "serial", "alias"]);
const MAX_DEPTH = 5;

function walk(value: unknown, baseKey: string, depth: number, out: StreamCandidate[]): void {
  if (value === null || value === undefined || depth > MAX_DEPTH) return;
  if (typeof value === "string") {
    const cand = classifyUrl(value, baseKey);
    if (cand) out.push(cand);
    return;
  }
  if (typeof value !== "object") return;
  if (Array.isArray(value)) {
    if (value.length > 100) return;
    for (let i = 0; i < value.length; i++) walk(value[i], `${baseKey}[${i}]`, depth + 1, out);
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SKIP_KEYS.has(k)) continue;
    walk(v, baseKey ? `${baseKey}.${k}` : k, depth + 1, out);
  }
}

/** Полный анализ камеры: видеопоток-капабилити + все найденные URL в данных устройства */
export function analyzeCameraStream(device: Device): CameraStreamInfo {
  const candidates: StreamCandidate[] = [];
  const sources: Record<string, unknown> = {};

  if (device.quasar_info) sources["quasar_info"] = device.quasar_info;
  if (device.device_info) sources["device_info"] = device.device_info;
  if (device.groups && device.groups.length) sources["groups"] = device.groups;
  if (device.aliases && device.aliases.length) sources["aliases"] = device.aliases;

  const cap = (device.capabilities ?? []).find((c) => c.type === "devices.capabilities.video_stream");
  if (cap) sources["capabilities.video_stream"] = { parameters: cap.parameters, state: cap.state };

  for (let i = 0; i < (device.properties ?? []).length; i++) {
    const p = (device.properties ?? [])[i];
    if (p.parameters && p.parameters !== null) sources[`properties[${i}].parameters`] = p.parameters;
    if (p.state && p.state !== null) sources[`properties[${i}].state`] = p.state;
  }

  for (const [base, value] of Object.entries(sources)) {
    walk(value, base, 0, candidates);
  }

  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (!c.url) return true;
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  let videoStreamCap: CameraStreamInfo["videoStreamCap"];
  if (cap) {
    const s = (cap.state as Record<string, unknown> | undefined) ?? {};
    const p = (cap.parameters as Record<string, unknown> | undefined) ?? {};
    videoStreamCap = {
      instance: typeof s.instance === "string" ? s.instance : undefined,
      protocol: typeof p.protocol === "string" ? p.protocol : typeof s.protocol === "string" ? s.protocol : undefined,
      provider: typeof p.provider === "string" ? p.provider : typeof s.provider === "string" ? s.provider : undefined,
      profile: typeof p.profile === "string" ? p.profile : typeof s.profile === "string" ? s.profile : undefined,
      value: s.value,
    };
  }

  return { candidates: unique, videoStreamCap };
}

export const PLAYABLE_KINDS: ReadonlySet<StreamKind> = new Set(["hls", "mp4", "webm", "mjpeg", "snapshot"]);

/** Заголовок типа найденной ссылки */
export function streamKindLabel(kind: StreamKind): string {
  switch (kind) {
    case "hls": return "HLS (m3u8)";
    case "mp4": return "MP4";
    case "webm": return "WebM";
    case "snapshot": return "Снимок";
    case "mjpeg": return "MJPEG-поток";
    case "rtsp": return "RTSP";
    case "rtmp": return "RTMP";
    case "ws": return "WebSocket";
    case "generic": return "Ссылка";
    case "video_stream_cap": return "video_stream";
  }
}