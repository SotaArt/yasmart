import rateLimit from "express-rate-limit";
import type { Request } from "express";

/**
 * Короткий хеш строки (для ключей рейт-лимита).
 */
function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/**
 * Ключ лимита: по токену аккаунта, а не по IP.
 * Причина: панель обычно открыта сразу на нескольких устройствах за одним NAT
 * (один публичный IP) — лимит по IP давит всех сразу. Токен изолирует аккаунты.
 */
function keyGenerator(req: Request): string {
  const token = req.headers["x-yandex-token"];
  if (typeof token === "string" && token.trim()) {
    return `t:${shortHash(token.trim())}`;
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Global rate limiter — 1000 requests per 15 minutes per token/IP.
 * Applied to all routes.
 */
export function globalLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_GLOBAL || "1000", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Rate limit exceeded. Please try again later." },
    keyGenerator,
    skip: (req) => req.url?.startsWith("/api/healthz") ?? false,
  });
}

/**
 * Write limiter — 150 requests per 15 minutes per token/IP.
 * Applied to POST routes (device control, scenario execution).
 */
export function writeLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_WRITE || "150", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Write rate limit exceeded. Please try again later." },
    keyGenerator,
  });
}

/**
 * Read limiter — 600 requests per 15 minutes per token/IP.
 * Applied to GET routes (user info, scenarios list, weather).
 */
export function readLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_READ || "600", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Read rate limit exceeded. Please try again later." },
    keyGenerator,
  });
}
