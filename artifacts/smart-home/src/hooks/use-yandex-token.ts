import { useState, useEffect, useCallback } from "react";

const TOKEN_STATUS_URL = "/api/yandex/token";
const LEGACY_TOKEN_KEY = "yandex_access_token";
const TOKEN_CHANGED_EVENT = "yandex-token-changed";

/**
 * The browser only knows whether the server has a token. The real Yandex
 * token stays in the encrypted server-side vault, so components can keep
 * passing a truthy sentinel to the generated API client without ever seeing
 * the secret.
 */
const SERVER_TOKEN_SENTINEL = "server";

class TokenRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TokenRequestError";
  }
}

interface TokenStatusResponse {
  configured: boolean;
  updatedAt: number | null;
}

async function readStatus(): Promise<TokenStatusResponse> {
  const res = await fetch(TOKEN_STATUS_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new TokenRequestError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as TokenStatusResponse;
}

async function storeToken(token: string): Promise<void> {
  const res = await fetch(TOKEN_STATUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data.error === "string" && data.error) message = data.error;
    } catch {
      // Keep the HTTP status when the body is not JSON.
    }
    throw new TokenRequestError(message, res.status);
  }
}

async function removeToken(): Promise<void> {
  const res = await fetch(TOKEN_STATUS_URL, { method: "DELETE" });
  if (!res.ok) throw new TokenRequestError(`HTTP ${res.status}`, res.status);
}

let bootstrapPromise: Promise<boolean> | null = null;

/**
 * On first load, migrate a token from the old localStorage-based version.
 * The plaintext token is sent to the server once and then removed locally.
 */
function bootstrapToken(): Promise<boolean> {
  if (bootstrapPromise) return bootstrapPromise;

  const promise = (async () => {
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);

    try {
      const status = await readStatus();
      if (status.configured) {
        if (legacy) localStorage.removeItem(LEGACY_TOKEN_KEY);
        return true;
      }

      if (!legacy) return false;

      try {
        await storeToken(legacy);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        return true;
      } catch (err) {
        // The server answered and rejected the token: it is unusable, drop it.
        if (err instanceof TokenRequestError && err.status >= 400 && err.status < 500) {
          localStorage.removeItem(LEGACY_TOKEN_KEY);
        }
        return false;
      }
    } catch {
      // Dashboard/API is unreachable. Do not delete a legacy token blindly.
      return false;
    }
  })();

  bootstrapPromise = promise;
  return promise.finally(() => {
    if (bootstrapPromise === promise) bootstrapPromise = null;
  });
}

export function useYandexToken() {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await readStatus();
      setTokenState(status.configured ? SERVER_TOKEN_SENTINEL : null);
    } catch {
      setTokenState(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    bootstrapToken().then((configured) => {
      if (cancelled) return;
      setTokenState(configured ? SERVER_TOKEN_SENTINEL : null);
      setIsLoaded(true);
    });

    const onChange = () => {
      void refresh();
    };
    window.addEventListener(TOKEN_CHANGED_EVENT, onChange);

    return () => {
      cancelled = true;
      window.removeEventListener(TOKEN_CHANGED_EVENT, onChange);
    };
  }, [refresh]);

  const setToken = useCallback(async (newToken: string | null) => {
    if (newToken) {
      await storeToken(newToken);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      setTokenState(SERVER_TOKEN_SENTINEL);
    } else {
      await removeToken();
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      setTokenState(null);
    }

    setIsLoaded(true);
    window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
  }, []);

  return { token, setToken, isLoaded };
}
