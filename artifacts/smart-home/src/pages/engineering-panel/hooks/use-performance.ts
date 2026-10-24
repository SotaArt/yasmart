import { useState, useEffect, useRef, useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";

export interface PerformanceMetrics {
  fps: number;
  wsLatency: number | null;
  memoryUsed: number | null;
  memoryTotal: number | null;
  queryCacheStats: {
    total: number;
    fresh: number;
    stale: number;
    fetching: number;
  };
}

export function usePerformance(queryClient: QueryClient, wsConnected: boolean, enabled = true) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    wsLatency: null,
    memoryUsed: null,
    memoryTotal: null,
    queryCacheStats: { total: 0, fresh: 0, stale: 0, fetching: 0 },
  });
  const lastTimeRef = useRef(performance.now());
  const countRef = useRef(0);

  // FPS counter
  useEffect(() => {
    if (!enabled) return;
    let rafId: number;

    const tick = (now: number) => {
      countRef.current++;
      if (now - lastTimeRef.current >= 1000) {
        const fps = Math.round((countRef.current * 1000) / (now - lastTimeRef.current));
        countRef.current = 0;
        lastTimeRef.current = now;

        // Query cache stats
        const cache = queryClient.getQueryCache();
        const caches = cache.getAll();
        const queryCacheStats = {
          total: caches.length,
          fresh: caches.filter((q) => q.isStale() === false).length,
          stale: caches.filter((q) => q.isStale() === true).length,
          fetching: caches.filter((q) => q.state.status === "pending").length,
        };

        // Memory (Chrome only)
        const perf = performance as any;
        const memoryUsed = perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : null;
        const memoryTotal = perf.memory ? Math.round(perf.memory.jsHeapSizeLimit / 1048576) : null;

        setMetrics((prev) => ({
          ...prev,
          fps,
          queryCacheStats,
          memoryUsed,
          memoryTotal,
        }));
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [queryClient, enabled]);

  // WS latency estimation (simple ping via fetch)
  useEffect(() => {
    if (!enabled || !wsConnected) {
      setMetrics((prev) => ({ ...prev, wsLatency: null }));
      return;
    }

    const measure = async () => {
      const start = performance.now();
      try {
        await fetch("/api/healthz");
        const latency = Math.round(performance.now() - start);
        setMetrics((prev) => ({ ...prev, wsLatency: latency }));
      } catch {
        setMetrics((prev) => ({ ...prev, wsLatency: null }));
      }
    };

    measure();
    const interval = setInterval(measure, 10000);
    return () => clearInterval(interval);
  }, [wsConnected]);

  const refresh = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const caches = cache.getAll();
    setMetrics((prev) => ({
      ...prev,
      queryCacheStats: {
        total: caches.length,
        fresh: caches.filter((q) => q.isStale() === false).length,
        stale: caches.filter((q) => q.isStale() === true).length,
        fetching: caches.filter((q) => q.state.status === "pending").length,
      },
    }));
  }, [queryClient]);

  return { metrics, refresh };
}
