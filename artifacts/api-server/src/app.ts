import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders } from "./middlewares/security-headers";
import { requestTimer } from "./middlewares/request-timer";
import { globalLimiter } from "./middlewares/rate-limit";
import { dashboardAuth } from "./middlewares/dashboard-auth";
import { bufferRequest } from "./lib/request-log-buffer";

const app: Express = express();

app.use(requestTimer);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    customLogLevel(_req, res, err) {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage(req, res) {
      const duration = req.startTime ? Date.now() - req.startTime : 0;
      return `${req.method} ${req.url?.split("?")[0]} completed in ${duration}ms`;
    },
    customErrorMessage(_req, res, err) {
      return `request error: ${err.message}`;
    },
    autoLogging: {
      ignore: (req) => req.url?.startsWith("/api/health") ?? false,
    },
  }),
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "x-yandex-token"],
  }),
);
app.use(securityHeaders);
// Rate-limit before auth so failed password attempts are throttled too.
app.use(globalLimiter());
// Gate the whole app (UI, API, WebSocket) before parsing any untrusted body.
app.use(dashboardAuth);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Buffer API requests for engineering panel monitoring
app.use((_req, res, next) => {
  const start = _req.startTime ?? Date.now();
  res.on("finish", () => {
    bufferRequest({
      id: (_req as any).id ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: start,
      method: _req.method,
      path: (_req.url ?? "").split("?")[0],
      statusCode: res.statusCode,
      duration: Date.now() - start,
      ip: _req.ip ?? "unknown",
    });
  });
  next();
});

app.use("/api", router);

// Serve the built frontend (production single-process mode).
// Set PUBLIC_DIR to the folder with the Vite build output, e.g. ../../smart-home/dist/public
if (process.env.PUBLIC_DIR) {
  const publicDir = path.resolve(process.env.PUBLIC_DIR);
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.use((req, res, next) => {
      // SPA fallback: everything non-API falls through to index.html
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }
      const indexPath = path.join(publicDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
        return;
      }
      next();
    });
    logger.info({ publicDir }, "Serving static frontend from PUBLIC_DIR");
  } else {
    logger.warn({ publicDir }, "PUBLIC_DIR set but not found — skipping static frontend");
  }
}

export default app;
