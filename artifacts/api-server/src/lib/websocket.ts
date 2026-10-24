import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { logger } from "./logger";
import { isDashboardAuthorized } from "../middlewares/dashboard-auth";
import { getYandexToken } from "./token-vault";

interface ConnectedClient {
  ws: WebSocket;
  id: string;
}

const clients: Map<string, ConnectedClient> = new Map();

/**
 * Initialize WebSocket server on an existing HTTP server.
 *
 * Both the dashboard password (cookie/Basic) and the presence of a
 * server-side Yandex token are checked during the HTTP upgrade. The browser
 * never sends the Yandex token over the WebSocket.
 */
export function initWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req: IncomingMessage) => {
    if (!isDashboardAuthorized(req)) {
      ws.close(4003, "Unauthorized");
      return;
    }

    if (!getYandexToken()) {
      ws.close(4001, "Yandex token not configured");
      return;
    }

    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    clients.set(clientId, { ws, id: clientId });
    logger.info({ clientId }, "WebSocket client connected");
    ws.send(JSON.stringify({ type: "connected", clientId }));

    ws.on("close", () => {
      clients.delete(clientId);
      logger.info({ clientId }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      clients.delete(clientId);
      logger.error({ clientId, err }, "WebSocket error");
    });
  });

  logger.info("WebSocket server initialized on /ws");
}

/**
 * Broadcast a message to all connected clients.
 *
 * There is one Yandex account per server, and every dashboard client uses the
 * same server-side token, so per-token filtering is no longer needed. The
 * token argument is kept for call-site compatibility.
 */
export function broadcast(_token: string, message: Record<string, unknown>): void {
  broadcastAll(message);
}

/**
 * Broadcast to all connected clients.
 */
export function broadcastAll(message: Record<string, unknown>): void {
  const data = JSON.stringify(message);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

/** Close every dashboard WebSocket (e.g. after the Yandex token is removed). */
export function closeAllClients(code = 4001, reason = "Yandex token removed"): void {
  for (const client of clients.values()) {
    try {
      client.ws.close(code, reason);
    } catch {
      // The socket may already be closing.
    }
  }
  clients.clear();
}

/**
 * Get the number of connected clients.
 */
export function getConnectedCount(): number {
  return clients.size;
}
