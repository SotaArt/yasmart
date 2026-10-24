import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

export const SETTINGS_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : join(process.cwd(), "data");
export const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");

if (!existsSync(SETTINGS_DIR)) {
  mkdirSync(SETTINGS_DIR, { recursive: true });
}

export function loadSettings(): Record<string, unknown> {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      return {};
    }
    const data = readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function saveSettings(settings: Record<string, unknown>): void {
  // Write to a temp file and rename atomically, so a crash mid-write cannot
  // leave a truncated settings.json (which would silently load as {}).
  const tempFile = `${SETTINGS_FILE}.tmp`;
  writeFileSync(tempFile, JSON.stringify(settings, null, 2), "utf-8");
  renameSync(tempFile, SETTINGS_FILE);
}

export function updateSettings(patch: Record<string, unknown>): Record<string, unknown> {
  const current = loadSettings();
  const next = { ...current, ...patch };
  saveSettings(next);
  return next;
}