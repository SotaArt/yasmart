import type { Request, Response, NextFunction } from "express";

/**
 * Lightweight request timer middleware.
 * Sets req.startTime for duration calculation in pino-http customSuccessMessage.
 */
export function requestTimer(req: Request, _res: Response, next: NextFunction): void {
  req.startTime = Date.now();
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
    }
  }
}
