import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  /** Truthy when the server has a Yandex token. The real token is never sent. */
  token: string;
  onMessage?: (message: WebSocketMessage) => void;
  onDeviceUpdate?: (deviceId: string, state: Record<string, unknown>) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
}

/**
 * React hook for WebSocket connection to the API server.
 * Receives real-time device state updates.
 *
 * The server authenticates the upgrade with the dashboard session cookie and
 * reads the Yandex token from its own vault, so no token is sent here.
 */
export function useWebSocket({
  token,
  onMessage,
  onDeviceUpdate,
  onConnect,
  onDisconnect,
  reconnectInterval = 5000,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualCloseRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const mountedRef = useRef(true);

  // Store callbacks in refs to avoid reconnecting when they change
  const onMessageRef = useRef(onMessage);
  const onDeviceUpdateRef = useRef(onDeviceUpdate);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onDeviceUpdateRef.current = onDeviceUpdate;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  });

  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    manualCloseRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In dev, connect directly to API server; in prod, use same host
    const wsHost = import.meta.env.PROD
      ? window.location.host
      : `${window.location.hostname}:8080`;
    const url = `${protocol}//${wsHost}/ws`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current || wsRef.current !== ws) return;
        setIsConnected(true);
        setReconnectCount(0);
        onConnectRef.current?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessageRef.current?.(message);

          if (message.type === "device_update" && message.deviceId) {
            onDeviceUpdateRef.current?.(message.deviceId as string, message.state as Record<string, unknown>);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;

        // A stale socket must not reset or reconnect over a newer connection.
        if (wsRef.current !== ws) return;

        wsRef.current = null;
        setIsConnected(false);
        onDisconnectRef.current?.();

        if (manualCloseRef.current) return;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setReconnectCount((c) => c + 1);
          connect();
        }, reconnectInterval);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Connection failed, will retry
    }
  }, [token, reconnectInterval]);

  useEffect(() => {
    mountedRef.current = true;
    if (!token) setIsConnected(false);
    connect();

    return () => {
      mountedRef.current = false;
      manualCloseRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.close();
      }
    };
  }, [connect]);

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const ws = wsRef.current;
    wsRef.current = null;

    if (ws) ws.close();

    setIsConnected(false);
    onDisconnectRef.current?.();
  }, []);

  return {
    isConnected,
    reconnectCount,
    send,
    disconnect,
  };
}
