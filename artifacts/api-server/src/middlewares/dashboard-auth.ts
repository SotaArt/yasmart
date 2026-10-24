import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Request, Response, NextFunction } from "express";

/**
 * App-level access protection.
 *
 * The dashboard has no user accounts of its own, so access to the whole app
 * (UI, API, WebSocket) is gated by a single password from DASHBOARD_PASSWORD.
 * The browser is authenticated with HTTP Basic auth; after the first successful
 * request we also set a signed HttpOnly cookie, which is what the WebSocket
 * handshake uses (browsers cannot attach the Basic header to a WS handshake).
 */

const COOKIE_NAME = "dash_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === "") return undefined;
  return value.trim();
}

function dashboardPassword(): string | undefined {
  return readEnv("DASHBOARD_PASSWORD");
}

function dashboardUser(): string {
  return readEnv("DASHBOARD_USER") ?? "admin";
}

function sessionSecret(): string {
  return readEnv("SESSION_SECRET") ?? dashboardPassword() ?? "";
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function parseBasicAuth(header: string | undefined): { user: string; pass: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { user: decoded.slice(0, separator), pass: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function hasValidBasicAuth(req: IncomingMessage): boolean {
  const password = dashboardPassword();
  if (!password) return false;
  const basic = parseBasicAuth(req.headers.authorization);
  if (!basic) return false;
  return safeEqual(basic.user, dashboardUser()) && safeEqual(basic.pass, password);
}

function hasValidSession(req: IncomingMessage): boolean {
  const cookies = parseCookieHeader(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;
  const [expires, signature] = raw.split(".");
  if (!expires || !signature) return false;
  if (!/^\d+$/.test(expires)) return false;
  if (Number(expires) < Date.now()) return false;
  return safeEqual(signature, sign(expires));
}

/** True when the request is allowed to use the dashboard. No password configured => open (dev). */
export function isDashboardAuthorized(req: IncomingMessage): boolean {
  if (!dashboardPassword()) return true;
  return hasValidBasicAuth(req) || hasValidSession(req);
}

function sessionCookieHeader(): string {
  const expires = String(Date.now() + SESSION_TTL_MS);
  const value = `${expires}.${sign(expires)}`;
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function isPublicPath(path: string): boolean {
  // Hosting platforms probe the health endpoint without credentials.
  return path === "/api/healthz" || path === "/healthz";
}

export function dashboardAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS" || isPublicPath(req.path)) {
    next();
    return;
  }

  if (!dashboardPassword()) {
    next();
    return;
  }

  if (isDashboardAuthorized(req)) {
    if (hasValidBasicAuth(req)) {
      res.setHeader("Set-Cookie", sessionCookieHeader());
    }
    next();
    return;
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Smart Home Dashboard", charset="UTF-8"');
  res.status(401).json({ error: "Authentication required" });
}

/**
 * Fail fast instead of silently deploying an open dashboard.
 * Only an explicit development/test environment is allowed to run without a password.
 */
export function assertProductionAuthConfigured(): void {
  const env = process.env.NODE_ENV;
  if (env === "development" || env === "test") return;
  if (!dashboardPassword()) {
    throw new Error(
      "DASHBOARD_PASSWORD must be set. " +
        "Anyone with the URL could otherwise control the dashboard and its API. " +
        "Set NODE_ENV=development only for local work without a password.",
    );
  }
}
