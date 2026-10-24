import type { Request, Response, NextFunction } from "express";

/**
 * Security headers middleware — applies HSTS, CSP, and related headers in production.
 * In development, headers are omitted to avoid interfering with Vite HMR.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  // HSTS — 2 years, eligible for preload lists
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent framing (clickjacking protection)
  res.setHeader("X-Frame-Options", "DENY");

  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Disable legacy XSS protection (can introduce vulnerabilities in older browsers)
  res.setHeader("X-XSS-Protection", "0");

  // Keep the private dashboard out of search indexes
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  // Content Security Policy — restrict sources to self + proxied APIs
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self' wss: https://api.iot.yandex.net https://api.open-meteo.com https://nominatim.openstreetmap.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  next();
}
