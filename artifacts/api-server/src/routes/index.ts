import { Router, type IRouter } from "express";
import healthRouter from "./health";
import yandexRouter from "./yandex";
import yandexTokenRouter from "./yandex-token";
import weatherRouter from "./weather";
import settingsRouter from "./settings";
import engineRouter from "./engine";
import { requireToken } from "../middlewares/require-token";
import { getRequestLog, clearRequestLog } from "../lib/request-log-buffer";
import { getConnectedCount } from "../lib/websocket";

const router: IRouter = Router();

router.use(healthRouter);
router.use(weatherRouter);
router.use(settingsRouter);
router.use(engineRouter);
router.use(yandexTokenRouter);
router.use(requireToken, yandexRouter);

// Debug endpoint: return device capabilities for thermostat devices
router.get("/debug/capabilities", async (req, res): Promise<void> => {
  const token = req.headers["x-yandex-token"];
  if (!token || typeof token !== "string" || token.trim() === "") {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  try {
    const response = await fetch("https://api.iot.yandex.net/v1.0/user/info", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: "Yandex API error" });
      return;
    }

    const data = await response.json() as any;
    const devices = data.devices ?? [];
    const rooms = data.rooms ?? [];

    // Return room names for debugging
    const roomNames = rooms.map((r: any) => ({ id: r.id, name: r.name }));

    // Filter thermostat devices and return their capabilities
    const thermostats = devices
      .filter((d: any) => d.type?.includes("thermostat"))
      .map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        capabilities: d.capabilities?.map((c: any) => ({
          type: c.type,
          state: c.state,
          parameters: c.parameters,
        })),
        properties: d.properties?.map((p: any) => ({
          type: p.type,
          state: p.state,
          parameters: p.parameters,
        })),
      }));

    res.json({ rooms: roomNames, thermostats, total_devices: devices.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Engineering panel endpoints
router.get("/engineering/logs", (_req, res) => {
  res.json({
    requests: getRequestLog(),
    wsConnections: getConnectedCount(),
  });
});

router.delete("/engineering/logs", (_req, res) => {
  clearRequestLog();
  res.json({ ok: true });
});

export default router;
