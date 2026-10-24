/**
 * REST API движка сценариев.
 *
 * TOKEN: движок использует сохранённый на сервере токен (engine_token),
 * настройки хранятся в data/settings.json под ключом engine_v1.
 */

import { Router, type IRouter } from "express";
import { getEngine } from "../scenarios/engine";
import type { Override, HomeMode } from "../scenarios/types";
import { HOME_MODES } from "../scenarios/types";
import { fetchYandexUserInfo, YandexApiError } from "../lib/yandex-client";
import { writeLimiter } from "../middlewares/rate-limit";
import { closeAllClients } from "../lib/websocket";

const router: IRouter = Router();

// ── Состояние движка ────────────────────────────────────────────────

router.get("/engine/state", (_req, res) => {
  res.json(getEngine().getState());
});

router.get("/engine/history", (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));
  res.json(getEngine().getHistory(limit));
});

router.post("/engine/enabled", (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be boolean" });
    return;
  }
  getEngine().setEnabled(enabled);
  res.json({ ok: true });
});

router.post("/engine/presence", (req, res) => {
  const mode = req.body?.mode as HomeMode;
  if (!HOME_MODES.includes(mode)) {
    res.status(400).json({ error: `mode must be one of ${HOME_MODES.join(", ")}` });
    return;
  }
  getEngine().setPresence(mode);
  res.json({ ok: true });
});

// ── Токен ───────────────────────────────────────────────────────────

router.post("/engine/token", writeLimiter(), async (req, res): Promise<void> => {
  const raw = req.body?.token;
  if (typeof raw !== "string" || raw.length > 4096) {
    res.status(400).json({ error: "invalid token" });
    return;
  }

  const token = raw.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, "").trim();
  if (token.length < 10) {
    res.status(400).json({ error: "invalid token" });
    return;
  }
  if (!/^[A-Za-z0-9._~+/=-]+$/.test(token)) {
    res.status(400).json({
      error: "Некорректный токен. Скопируйте только значение access_token из адресной строки после #.",
    });
    return;
  }

  try {
    await fetchYandexUserInfo(token);
  } catch (err) {
    if (err instanceof YandexApiError && (err.status === 401 || err.status === 403)) {
      res.status(400).json({
        error: "Токен отклонён Яндексом. Проверьте, что скопирован access_token.",
      });
      return;
    }
    req.log.warn({ err }, "Failed to verify the Yandex token for the engine");
    res.status(502).json({ error: "Не удалось проверить токен в Яндекс API. Попробуйте ещё раз." });
    return;
  }

  getEngine().setToken(token);
  res.json({ ok: true });
});

router.delete("/engine/token", writeLimiter(), (_req, res) => {
  getEngine().setToken(null);
  closeAllClients(4001, "Yandex token removed");
  res.json({ ok: true });
});

// ── Сценарии ────────────────────────────────────────────────────────

router.post("/engine/scenarios/:id/update", (req, res) => {
  const { id } = req.params;
  const scenario = getEngine().getScenario(id);
  if (!scenario) {
    res.status(404).json({ error: "scenario not found" });
    return;
  }
  const patch = req.body;
  if (!patch || typeof patch !== "object") {
    res.status(400).json({ error: "invalid body" });
    return;
  }
  getEngine().updateScenario(id, patch);
  res.json(getEngine().getScenario(id));
});

router.post("/engine/scenarios/:id/enable", (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be boolean" });
    return;
  }
  getEngine().setScenarioEnabled(req.params.id, enabled);
  res.json({ ok: true });
});

router.post("/engine/scenarios/:id/run", async (req, res) => {
  const result = await getEngine().runScenarioNow(req.params.id, true);
  if (!result) {
    res.status(404).json({ error: "scenario not found" });
    return;
  }
  res.json(result);
});

// ── Ручные переопределения ──────────────────────────────────────────

router.get("/engine/overrides", (_req, res) => {
  res.json(getEngine().getOverrides());
});

router.post("/engine/overrides", (req, res) => {
  const body = req.body;
  if (!body?.deviceId || typeof body.deviceId !== "string") {
    res.status(400).json({ error: "deviceId required" });
    return;
  }
  const ttlMs = Number(body.ttlMs) || 0;
  const override: Override = {
    deviceId: body.deviceId,
    label: String(body.label ?? body.deviceId),
    reason: String(body.reason ?? "вручную"),
    since: Date.now(),
    until: ttlMs > 0 ? Date.now() + ttlMs : 0,
  };
  getEngine().setOverride(override);
  res.json({ ok: true });
});

router.delete("/engine/overrides/:deviceId", (req, res) => {
  getEngine().clearOverride(req.params.deviceId);
  res.json({ ok: true });
});

// ── Информация о устройствах (для конфигурации климат-сценария) ─────

export default router;