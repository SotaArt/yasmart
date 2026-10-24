/**
 * Единый низкоуровневый клиент к Yandex IoT API.
 *
 * Используется и существующим reverse-proxy (routes/yandex.ts),
 * и движком сценариев (scenarios/*) — чтобы не дублировать логику доступа.
 */

const YANDEX_API_BASE = "https://api.iot.yandex.net";

export class YandexApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(`Yandex API error: ${status}`);
    this.name = "YandexApiError";
  }
}

/** Safely parse JSON — returns null if the body is not valid JSON */
export async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sanitizeToken(token: string): string {
  // Strip any non-ASCII characters that some copy/paste actions may introduce.
  return token.replace(/[^\x20-\x7E]/g, "").trim();
}

export async function yandexFetch(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<Response> {
  const clean = sanitizeToken(token);
  if (!clean) throw new Error("Invalid Yandex token");

  return fetch(`${YANDEX_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${clean}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export async function fetchYandexUserInfo(token: string): Promise<unknown> {
  const res = await yandexFetch("/v1.0/user/info", token);
  const data = await safeJson(res);
  if (!res.ok) throw new YandexApiError(res.status, data);
  return data;
}

export async function sendYandexDeviceActions(
  token: string,
  deviceId: string,
  actions: { type: string; state: Record<string, unknown> }[]
): Promise<{ status: string; request_id?: string }> {
  const res = await yandexFetch(`/v1.0/devices/${deviceId}/actions`, token, {
    method: "POST",
    body: JSON.stringify({ actions }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new YandexApiError(res.status, data);
  return (data ?? { status: "ok" }) as { status: string; request_id?: string };
}