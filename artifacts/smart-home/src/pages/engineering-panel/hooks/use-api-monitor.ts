import { useState, useEffect, useCallback } from "react";

export interface ApiRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status: number | null;
  duration: number | null;
  error?: string;
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = "eng_api_monitor_v1";

function loadRequests(): ApiRequest[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function saveRequests(entries: ApiRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // quota exceeded
  }
}

let interceptInstalled = false;
let interceptListeners: Array<(req: ApiRequest) => void> = [];

function installIntercept() {
  if (interceptInstalled) return;
  interceptInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
    // Only capture /api/ requests from our app
    if (!url.startsWith("/api/")) return originalFetch(...args);

    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const start = performance.now();
    const method = typeof args[1]?.method === "string" ? args[1].method : "GET";

    const req: ApiRequest = {
      id,
      timestamp: Date.now(),
      method,
      url: url.split("?")[0],
      status: null,
      duration: null,
    };

    // Notify all listeners
    for (const listener of interceptListeners) {
      listener(req);
    }

    try {
      const res = await originalFetch(...args);
      const completed: ApiRequest = {
        ...req,
        status: res.status,
        duration: Math.round(performance.now() - start),
      };
      for (const listener of interceptListeners) {
        listener(completed);
      }
      return res;
    } catch (err) {
      const failed: ApiRequest = {
        ...req,
        status: 0,
        duration: Math.round(performance.now() - start),
        error: String(err),
      };
      for (const listener of interceptListeners) {
        listener(failed);
      }
      throw err;
    }
  };
}

export function useApiMonitor(enabled: boolean) {
  const [requests, setRequests] = useState<ApiRequest[]>(loadRequests);

  useEffect(() => {
    saveRequests(requests);
  }, [requests]);

  // Always install the intercept (not just when enabled)
  useEffect(() => {
    installIntercept();

    const listener = (req: ApiRequest) => {
      setRequests((prev) => {
        // If it's a new request (no status yet), add it
        if (!prev.some((r) => r.id === req.id)) {
          return [...prev.slice(-(MAX_ENTRIES - 1)), req];
        }
        // Otherwise update existing
        return prev.map((r) => (r.id === req.id ? req : r));
      });
    };

    interceptListeners.push(listener);
    return () => {
      interceptListeners = interceptListeners.filter((l) => l !== listener);
    };
  }, []);

  const clear = useCallback(() => {
    setRequests([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const stats = {
    total: requests.length,
    avgDuration: requests.length > 0
      ? Math.round(requests.reduce((sum, r) => sum + (r.duration ?? 0), 0) / requests.length)
      : 0,
    errorCount: requests.filter((r) => r.status === 0 || (r.status !== null && r.status >= 400) || !!r.error).length,
    successCount: requests.length -
      requests.filter((r) => r.status === 0 || (r.status !== null && r.status >= 400) || !!r.error).length,
    errorRate: requests.length > 0
      ? Math.round((requests.filter((r) => r.status === 0 || (r.status !== null && r.status >= 400) || !!r.error).length / requests.length) * 100)
      : 0,
  };

  return { requests: enabled ? requests : [], clear, stats };
}
