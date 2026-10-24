import { Router, type IRouter } from "express";
import {
  GetUserInfoHeader,
  GetUserInfoResponse,
  ControlDeviceParams,
  ControlDeviceHeader,
  ControlDeviceBody,
  ControlDeviceResponse,
  GetScenariosHeader,
  GetScenariosResponse,
  RunScenarioParams,
  RunScenarioHeader,
  RunScenarioResponse,
} from "@workspace/api-zod";
import { readLimiter, writeLimiter } from "../middlewares/rate-limit";
import { broadcast } from "../lib/websocket";
import { safeJson, yandexFetch } from "../lib/yandex-client";

const router: IRouter = Router();

/** Mask upstream error codes — never leak Yandex-specific status codes to client */
function maskUpstreamStatus(upstreamStatus: number): number {
  if (upstreamStatus >= 400 && upstreamStatus < 500) return 502;
  if (upstreamStatus >= 500) return 502;
  return 502;
}

router.get("/yandex/user-info", readLimiter(), async (req, res): Promise<void> => {
  const headers = GetUserInfoHeader.safeParse(req.headers);
  if (!headers.success) {
    req.log.warn({ errors: headers.error.message }, "Missing Yandex token");
    res.status(401).json({ error: "Missing or invalid x-yandex-token header" });
    return;
  }

  const token = headers.data["x-yandex-token"];

  try {
    const response = await yandexFetch("/v1.0/user/info", token);

    const data = await safeJson(response);

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Yandex API error on user-info");
      res.status(maskUpstreamStatus(response.status)).json({
        error: `Yandex API error`,
      });
      return;
    }

    const parsed = GetUserInfoResponse.safeParse(data);
    if (!parsed.success) {
      req.log.error({ err: parsed.error }, "Zod parse error on user-info");
      res.status(502).json({ error: "Unexpected response shape from Yandex API" });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Yandex user info");
    res.status(502).json({ error: "Failed to reach Yandex API" });
  }
});

/**
 * Raw data export — returns the full Yandex API response without Zod validation.
 * Used by Engineer Dashboard to inspect all available device data.
 */
router.get("/yandex/raw-export", readLimiter(), async (req, res): Promise<void> => {
  const token = req.headers["x-yandex-token"];
  if (!token || typeof token !== "string" || token.trim() === "") {
    res.status(401).json({ error: "Missing or empty x-yandex-token header" });
    return;
  }

  try {
    const response = await yandexFetch("/v1.0/user/info", token);

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      req.log.warn({ status: response.status, body: errText }, "Yandex API error on raw-export");
      res.status(502).json({ error: `Yandex API error: ${response.status}` });
      return;
    }

    const raw = await response.json();

    // Scenarios are already included in the user/info response
    const scenariosRaw = { scenarios: (raw as any)?.scenarios ?? [] };

    const exportData = {
      exportedAt: new Date().toISOString(),
      source: "Yandex IoT API v1.0",
      userInfo: raw,
      scenarios: scenariosRaw,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="yandex-export-${Date.now()}.json"`);
    res.json(exportData);
  } catch (err) {
    req.log.error({ err }, "Failed to export raw data");
    res.status(502).json({ error: "Failed to export data" });
  }
});

router.post("/yandex/devices/:deviceId/actions", writeLimiter(), async (req, res): Promise<void> => {
  const params = ControlDeviceParams.safeParse({ deviceId: req.params.deviceId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const headersResult = ControlDeviceHeader.safeParse(req.headers);
  if (!headersResult.success) {
    res.status(401).json({ error: "Missing or invalid x-yandex-token header" });
    return;
  }

  const body = ControlDeviceBody.safeParse(req.body);
  if (!body.success) {
    req.log.warn({ errors: body.error.message }, "Invalid device action body");
    res.status(400).json({ error: body.error.message });
    return;
  }

  const token = headersResult.data["x-yandex-token"];

  try {
    const response = await yandexFetch(
      `/v1.0/devices/${params.data.deviceId}/actions`,
      token,
      {
        method: "POST",
        body: JSON.stringify(body.data),
      }
    );

    const data = await safeJson(response);

    if (!response.ok) {
      req.log.warn({ status: response.status, body: data, request_body: body.data }, "Yandex API error on device action");
      res.status(maskUpstreamStatus(response.status)).json({
        error: `Yandex API error`,
        details: data,
      });
      return;
    }

    const parsed = ControlDeviceResponse.safeParse(data);
    if (!parsed.success) {
      req.log.error({ err: parsed.error }, "Zod parse error on device action");
      res.status(502).json({ error: "Unexpected response shape from Yandex API" });
      return;
    }

    // Broadcast device state change to WebSocket clients
    broadcast(token, {
      type: "device_update",
      deviceId: params.data.deviceId,
      actions: body.data.actions,
      timestamp: Date.now(),
    });

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to send device action");
    res.status(502).json({ error: "Failed to reach Yandex API" });
  }
});

router.get("/yandex/scenarios", readLimiter(), async (req, res): Promise<void> => {
  const headersResult = GetScenariosHeader.safeParse(req.headers);
  if (!headersResult.success) {
    res.status(401).json({ error: "Missing or invalid x-yandex-token header" });
    return;
  }

  const token = headersResult.data["x-yandex-token"];

  try {
    // Scenarios are part of the user/info response in Yandex IoT API
    const response = await yandexFetch("/v1.0/user/info", token);

    const data = await safeJson(response);

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Yandex API error on scenarios (via user/info)");
      res.status(maskUpstreamStatus(response.status)).json({
        error: `Yandex API error`,
      });
      return;
    }

    // Extract scenarios from user info response
    const scenarios = (data as any)?.scenarios ?? [];

    const parsed = GetScenariosResponse.safeParse({ status: "ok", scenarios });
    if (!parsed.success) {
      req.log.error({ err: parsed.error }, "Zod parse error on scenarios");
      res.json({ status: "ok", scenarios: [] });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Yandex scenarios");
    res.status(502).json({ error: "Failed to reach Yandex API" });
  }
});

router.post("/yandex/scenarios/:scenarioId/actions", writeLimiter(), async (req, res): Promise<void> => {
  const params = RunScenarioParams.safeParse({ scenarioId: req.params.scenarioId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const headersResult = RunScenarioHeader.safeParse(req.headers);
  if (!headersResult.success) {
    res.status(401).json({ error: "Missing or invalid x-yandex-token header" });
    return;
  }

  const token = headersResult.data["x-yandex-token"];

  try {
    const response = await yandexFetch(
      `/v1.0/scenarios/${params.data.scenarioId}/actions`,
      token,
      { method: "POST" }
    );

    const data = await safeJson(response);

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Yandex API error on scenario run");
      res.status(maskUpstreamStatus(response.status)).json({
        error: `Yandex API error`,
      });
      return;
    }

    const parsed = RunScenarioResponse.safeParse(data);
    if (!parsed.success) {
      req.log.error({ err: parsed.error }, "Zod parse error on scenario run");
      res.status(502).json({ error: "Unexpected response shape from Yandex API" });
      return;
    }

    // Broadcast scenario execution to WebSocket clients
    broadcast(token, {
      type: "scenario_run",
      scenarioId: params.data.scenarioId,
      timestamp: Date.now(),
    });

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to run Yandex scenario");
    res.status(502).json({ error: "Failed to reach Yandex API" });
  }
});

export default router;
