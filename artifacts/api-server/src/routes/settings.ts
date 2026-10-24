import { Router, type IRouter } from "express";
import { loadSettings, saveSettings } from "../lib/settings";
import { YANDEX_TOKEN_KEY } from "../lib/token-vault";

const router: IRouter = Router();

/**
 * Keys that contain secrets or are fully owned by the server.
 * They must never be read through the generic settings API and must only be
 * written by their dedicated endpoint (e.g. POST /api/yandex/token).
 */
const SERVER_MANAGED_KEYS = new Set(["engine_v1", YANDEX_TOKEN_KEY]);

function redactSensitive(key: string, value: unknown): unknown {
  if (key === YANDEX_TOKEN_KEY) return value ? "***" : null;
  if (key !== "engine_v1" || !value || typeof value !== "object") return value;
  const clone = structuredClone(value) as Record<string, unknown>;
  clone["token"] = clone["token"] ? "***" : null;
  return clone;
}

function redactAll(settings: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [key, redactSensitive(key, value)]),
  );
}

// GET /api/settings — загрузить все настройки (секреты вырезаны)
router.get("/settings", (_req, res) => {
  try {
    res.json(redactAll(loadSettings()));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/settings/:key — загрузить конкретную настройку (секреты вырезаны)
router.get("/settings/:key", (req, res) => {
  try {
    const settings = loadSettings();
    const value = settings[req.params.key];
    if (value === undefined) {
      res.status(404).json({ error: "Setting not found" });
      return;
    }
    res.json(redactSensitive(req.params.key, value));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/settings — сохранить настройки (частичное обновление)
router.post("/settings", (req, res) => {
  try {
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== "object" || Array.isArray(newSettings)) {
      res.status(400).json({ error: "Invalid settings object" });
      return;
    }

    const blocked = Object.keys(newSettings).filter((key) => SERVER_MANAGED_KEYS.has(key));
    if (blocked.length > 0) {
      res.status(403).json({
        error: `Settings are server-managed and cannot be written here: ${blocked.join(", ")}`,
      });
      return;
    }

    const currentSettings = loadSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    saveSettings(updatedSettings);

    res.json({ ok: true, keys: Object.keys(updatedSettings) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/settings/:key — удалить конкретную настройку
router.delete("/settings/:key", (req, res) => {
  try {
    if (SERVER_MANAGED_KEYS.has(req.params.key)) {
      res.status(403).json({ error: "Setting is server-managed and cannot be deleted here" });
      return;
    }

    const settings = loadSettings();
    delete settings[req.params.key];
    saveSettings(settings);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;