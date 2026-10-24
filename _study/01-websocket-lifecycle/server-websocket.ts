import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger";

interface ConnectedClient {
  ws: WebSocket;
  token: string;
  id: string;
}

const clients: Map<string, ConnectedClient> = new Map();

/**
 * Initialize WebSocket server on an existing HTTP server.
 */
export function initWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token") ?? "";

    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    clients.set(clientId, { ws, token, id: clientId });

    logger.info({ clientId }, "WebSocket client connected");

    ws.on("close", () => {
      clients.delete(clientId);
      logger.info({ clientId }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ clientId, err }, "WebSocket error");
      clients.delete(clientId);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: "connected", clientId }));
  });

  logger.info("WebSocket server initialized on /ws");
}

/**
 * Broadcast a message to all connected clients with a matching token.
 */
export function broadcast(token: string, message: Record<string, unknown>): void {
  const data = JSON.stringify(message);
  for (const client of clients.values()) {
    if (client.token === token && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

/**
 * Broadcast to all connected clients (regardless of token).
 */
export function broadcastAll(message: Record<string, unknown>): void {
  const data = JSON.stringify(message);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

/**
 * Get the number of connected clients.
 */
export function getConnectedCount(): number {
  return clients.size;
}
