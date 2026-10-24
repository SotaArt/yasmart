import type { Request, Response, NextFunction } from "express";
import { getYandexToken } from "../lib/token-vault";

/**
 * Inject the server-side Yandex token into the request headers before the
 * proxy routes run. Any x-yandex-token sent by the browser is ignored: the
 * browser only has a dashboard session and never the real Yandex token.
 */
export function requireToken(req: Request, res: Response, next: NextFunction): void {
  const token = getYandexToken();

  if (!token) {
    res.status(401).json({ error: "Yandex token is not configured" });
    return;
  }

  req.headers["x-yandex-token"] = token;
  next();
}
