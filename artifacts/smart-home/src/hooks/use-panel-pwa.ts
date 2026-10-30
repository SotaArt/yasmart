import { useEffect } from "react";

export type PanelPwaMode = "user" | "mobile";

const LAST_PATH_KEY: Record<PanelPwaMode, string> = {
  user: "pwa_last_path_user",
  mobile: "pwa_last_path_mobile",
};

const MANIFEST_FILE: Record<PanelPwaMode, string> = {
  user: "manifest-user.json",
  mobile: "manifest-mobile.json",
};

/**
 * Делает текущую панель точкой входа для установленного PWA:
 * запоминает путь ЮП/МП и подключает соответствующий manifest.
 */
export function usePanelPwa(mode: PanelPwaMode) {
  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      localStorage.setItem(LAST_PATH_KEY[mode], path);
    } catch {
      // localStorage may be unavailable in private mode
    }
  }, [mode]);

  useEffect(() => {
    const link = document.getElementById("app-manifest") as HTMLLinkElement | null;
    const theme = document.querySelector('meta[name="theme-color"]');
    if (!link) return;

    const previousHref = link.getAttribute("href");
    const previousTheme = theme?.getAttribute("content") ?? null;
    const base = import.meta.env.BASE_URL;
    link.setAttribute("href", `${base}${MANIFEST_FILE[mode]}`);
    theme?.setAttribute("content", "#0a0a0b");

    return () => {
      if (previousHref) link.setAttribute("href", previousHref);
      if (theme && previousTheme) theme.setAttribute("content", previousTheme);
    };
  }, [mode]);
}
