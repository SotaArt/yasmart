import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initWebSocket } from "./lib/websocket";
import { startEngine } from "./scenarios/engine";
import { assertProductionAuthConfigured } from "./middlewares/dashboard-auth";
import { initTokenVault } from "./lib/token-vault";

assertProductionAuthConfigured();
initTokenVault();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocket(server);

// Start scenario engine background loop
startEngine();

// Start server
server.listen(port, () => {
  logger.info({ port }, "Server listening");
  logger.info({ port }, `WebSocket available at ws://localhost:${port}/ws`);
});

// Optional HTTP → HTTPS redirect. Disabled by default because most hosts and
// containers terminate TLS in front of the app (Caddy/Nginx/PaaS) and cannot
// bind port 80. Enable explicitly with HTTP_REDIRECT_PORT=80 when needed.
if (process.env.NODE_ENV === "production" && process.env.HTTP_REDIRECT_PORT) {
  const httpPort = parseInt(process.env.HTTP_REDIRECT_PORT, 10);

  const redirectServer = http.createServer((req, res) => {
    const host = req.headers.host?.replace(/:\d+$/, "") || "localhost";
    const targetUrl = `https://${host}${req.url}`;
    res.writeHead(301, { Location: targetUrl });
    res.end();
  });

  redirectServer.on("error", (err) => {
    logger.warn({ err, httpPort }, "HTTP redirect server failed to start — continuing without it");
  });

  redirectServer.listen(httpPort, () => {
    logger.info({ httpPort }, "HTTP redirect server listening (→ HTTPS)");
  });
}
