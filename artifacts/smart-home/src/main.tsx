import { createRoot } from "react-dom/client";
import { initTheme } from "@/lib/theme";
import App from "./App";
import "./index.css";

initTheme();
createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA (production only)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
