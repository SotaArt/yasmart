import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useWebSocket } from "./use-websocket";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  send(data: string) {
    this.sent.push(data);
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useWebSocket — базовое соединение", () => {
  it("подключается без передачи Yandex-токена и доставляет device_update", () => {
    const onDeviceUpdate = vi.fn();
    renderHook(() => useWebSocket({ token: "server", onDeviceUpdate }));
    const ws = MockWebSocket.instances[0];

    expect(ws.url).toMatch(/\/ws$/);
    expect(ws.url).not.toContain("token");
    act(() => ws.open());
    expect(ws.sent).toHaveLength(0);
    act(() =>
      ws.onmessage?.({ data: JSON.stringify({ type: "device_update", deviceId: "d1", state: { on: true } }) })
    );
    expect(onDeviceUpdate).toHaveBeenCalledWith("d1", { on: true });
  });

  it("send отправляет JSON только при открытом соединении", () => {
    const { result } = renderHook(() => useWebSocket({ token: "server" }));
    const ws = MockWebSocket.instances[0];

    result.current.send({ ping: 1 });
    expect(ws.sent).toHaveLength(0);

    act(() => ws.open());
    result.current.send({ ping: 1 });
    expect(ws.sent.at(-1)).toBe(JSON.stringify({ ping: 1 }));
  });

  it("размонтирование закрывает соединение", () => {
    const { unmount } = renderHook(() => useWebSocket({ token: "t" }));
    const ws = MockWebSocket.instances[0];
    act(() => ws.open());

    unmount();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });
});

describe("useWebSocket — регрессии жизненного цикла", () => {
  it(
    "позднее закрытие старого сокета не сбрасывает активное соединение",
    () => {
      const { result, rerender } = renderHook(
        ({ interval }) => useWebSocket({ token: "t", reconnectInterval: interval }),
        { initialProps: { interval: 5000 } }
      );

      const ws1 = MockWebSocket.instances[0];
      act(() => ws1.open());
      expect(result.current.isConnected).toBe(true);

      rerender({ interval: 1000 });
      const ws2 = MockWebSocket.instances[1];
      act(() => ws2.open());
      expect(result.current.isConnected).toBe(true);

      // устаревший сокет закрывается позже, когда уже активен ws2
      act(() => {
        ws1.readyState = MockWebSocket.CLOSED;
        ws1.onclose?.();
      });

      expect(result.current.isConnected).toBe(true);
    }
  );

  it(
    "disconnect() останавливает переподключение",
    () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useWebSocket({ token: "t", reconnectInterval: 5000 }));

      const ws1 = MockWebSocket.instances[0];
      act(() => ws1.open());
      expect(result.current.isConnected).toBe(true);

      act(() => result.current.disconnect());
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(MockWebSocket.instances).toHaveLength(1);
    }
  );
});
