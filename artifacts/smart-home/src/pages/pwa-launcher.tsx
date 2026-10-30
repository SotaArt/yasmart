import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";

const LAST_PATH_KEY = {
  user: "pwa_last_path_user",
  mobile: "pwa_last_path_mobile",
} as const;

type Mode = keyof typeof LAST_PATH_KEY;

/**
 * Точка входа установленного PWA. Открывает последнюю использованную
 * ЮП или МП, сохраняя корректный householdId в адресе.
 */
export default function PwaLauncher() {
  const search = useSearch();
  const [failed, setFailed] = useState(false);

  const mode = useMemo<Mode>(() => {
    const params = new URLSearchParams(search);
    return params.get("mode") === "mobile" ? "mobile" : "user";
  }, [search]);

  const household = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("household");
  }, [search]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const prefix = `${base}/${mode === "mobile" ? "mobile" : "panel"}/`;
    const fallback = household ? `${prefix}${household}` : null;

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LAST_PATH_KEY[mode]);
    } catch {
      // ignore
    }

    const target = stored && stored.startsWith(prefix) ? stored : fallback;
    if (target) {
      window.location.replace(target);
      return;
    }
    setFailed(true);
  }, [mode, household]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <div className="h-10 w-10 rounded-full border-2 border-border border-t-[hsl(var(--gold))] animate-spin" />
      {failed ? (
        <>
          <p className="text-sm">Панель ещё не открывалась на этом устройстве.</p>
          <p className="text-xs text-muted-foreground">
            Откройте ЮП или МП в браузере и установите приложение с этой страницы.
          </p>
          <a
            href={import.meta.env.BASE_URL}
            className="mt-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Перейти на главную
          </a>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Открываем панель…</p>
      )}
    </div>
  );
}
