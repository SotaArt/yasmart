import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { loadSettings, saveSettings } from "./settings";
import { logger } from "./logger";

/**
 * Server-side vault for the Yandex OAuth token.
 *
 * The token is encrypted with AES-256-GCM before it is written to
 * data/settings.json. The browser never receives it; the UI only asks whether
 * a token is configured and sends a new token once when the user connects.
 */

export const YANDEX_TOKEN_KEY = "yandex_token_v1";
const LEGACY_ENGINE_KEY = "engine_v1";
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const KEY_SALT = "smart-home-dashboard:yandex-token-vault:v1";
const DEV_FALLBACK_SECRET = "smart-home-dashboard-dev-token-key";

interface StoredToken {
  v: 1;
  ciphertext: string;
  updatedAt: number;
}

export interface YandexTokenStatus {
  configured: boolean;
  updatedAt: number | null;
}

interface VaultState {
  token: string | null;
  updatedAt: number | null;
}

let keyCache: Buffer | null = null;
let stateCache: VaultState | null = null;

function vaultSecret(): string {
  const explicit = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (explicit) return explicit;

  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (sessionSecret) return sessionSecret;

  const dashboardPassword = process.env.DASHBOARD_PASSWORD?.trim();
  if (dashboardPassword) return dashboardPassword;

  if (process.env.NODE_ENV !== "production") {
    logger.warn(
      "TOKEN_ENCRYPTION_KEY, SESSION_SECRET and DASHBOARD_PASSWORD are not set — " +
        "using an insecure development key for the Yandex token vault",
    );
    return DEV_FALLBACK_SECRET;
  }

  throw new Error(
    "TOKEN_ENCRYPTION_KEY (or SESSION_SECRET/DASHBOARD_PASSWORD) must be set " +
      "to store the Yandex token securely",
  );
}

function encryptionKey(): Buffer {
  if (!keyCache) {
    keyCache = scryptSync(vaultSecret(), KEY_SALT, 32);
  }
  return keyCache;
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptToken(payload: string): string | null {
  try {
    const [version, ivRaw, tagRaw, dataRaw] = payload.split(".");
    if (version !== VERSION || !ivRaw || !tagRaw || !dataRaw) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      encryptionKey(),
      Buffer.from(ivRaw, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    logger.warn(
      { err },
      "Failed to decrypt the stored Yandex token — treating it as missing. " +
        "Re-enter the token if TOKEN_ENCRYPTION_KEY/SESSION_SECRET changed.",
    );
    return null;
  }
}

function isStoredToken(value: unknown): value is StoredToken {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredToken>;
  return (
    record.v === 1 &&
    typeof record.ciphertext === "string" &&
    typeof record.updatedAt === "number"
  );
}

function stripLegacyToken(settings: Record<string, unknown>): boolean {
  const legacy = settings[LEGACY_ENGINE_KEY];
  if (!legacy || typeof legacy !== "object" || !("token" in legacy)) return false;

  const clone = { ...(legacy as Record<string, unknown>) };
  delete clone.token;
  settings[LEGACY_ENGINE_KEY] = clone;
  return true;
}

function loadFromDisk(): VaultState {
  const settings = loadSettings();
  let record: unknown = settings[YANDEX_TOKEN_KEY];
  let changed = false;

  if (!isStoredToken(record)) {
    const legacy = settings[LEGACY_ENGINE_KEY];
    const legacyToken =
      legacy && typeof legacy === "object" && typeof (legacy as { token?: unknown }).token === "string"
        ? (legacy as { token: string }).token.trim()
        : "";

    if (legacyToken.length > 10) {
      record = {
        v: 1,
        ciphertext: encryptToken(legacyToken),
        updatedAt: Date.now(),
      } satisfies StoredToken;
      settings[YANDEX_TOKEN_KEY] = record;
      changed = true;
      logger.info("Migrated the legacy engine token into the encrypted token vault");
    }
  }

  if (stripLegacyToken(settings)) changed = true;

  if (changed) {
    try {
      saveSettings(settings);
    } catch (err) {
      logger.error({ err }, "Failed to persist the migrated Yandex token vault");
    }
  }

  if (!isStoredToken(record)) {
    return { token: null, updatedAt: null };
  }

  const token = decryptToken(record.ciphertext);
  return {
    token,
    updatedAt: token ? record.updatedAt : null,
  };
}

function state(): VaultState {
  if (!stateCache) stateCache = loadFromDisk();
  return stateCache;
}

/** Run the lazy migration explicitly during startup. */
export function initTokenVault(): void {
  state();
}

export function getYandexToken(): string | null {
  return state().token;
}

export function hasYandexToken(): boolean {
  return (getYandexToken()?.length ?? 0) > 10;
}

export function getYandexTokenStatus(): YandexTokenStatus {
  const { token, updatedAt } = state();
  return {
    configured: (token?.length ?? 0) > 10,
    updatedAt: token ? updatedAt : null,
  };
}

/** Store a token, or clear it when `token` is null. */
export function setYandexToken(token: string | null): YandexTokenStatus {
  const settings = loadSettings();
  let updatedAt: number | null = null;

  if (token) {
    const trimmed = token.trim();
    updatedAt = Date.now();
    settings[YANDEX_TOKEN_KEY] = {
      v: 1,
      ciphertext: encryptToken(trimmed),
      updatedAt,
    } satisfies StoredToken;
  } else {
    delete settings[YANDEX_TOKEN_KEY];
  }

  stripLegacyToken(settings);
  saveSettings(settings);

  stateCache = {
    token: token ? token.trim() : null,
    updatedAt,
  };

  return getYandexTokenStatus();
}
