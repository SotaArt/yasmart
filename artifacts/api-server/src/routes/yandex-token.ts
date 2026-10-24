import { Router, type IRouter } from "express";
import { readLimiter, writeLimiter } from "../middlewares/rate-limit";
import { fetchYandexUserInfo, YandexApiError } from "../lib/yandex-client";
import { getYandexTokenStatus, setYandexToken } from "../lib/token-vault";
import { closeAllClients } from "../lib/websocket";

const router: IRouter = Router();

/** Status only — the token itself never leaves the server. */
router.get("/yandex/token", readLimiter(), (_req, res) => {
  res.json(getYandexTokenStatus());
});

/**
 * Save and verify a Yandex token. The token is sent once over HTTPS and then
 * stored encrypted on the server; the browser keeps only the dashboard session.
 */
router.post("/yandex/token", writeLimiter(), async (req, res): Promise<void> => {
  const raw = req.body?.token;
  if (typeof raw !== "string" || raw.length > 4096) {
    res.status(400).json({ error: "invalid token" });
    return;
  }

  // Strip all non-ASCII and whitespace to avoid header corruption on paste
  const token = raw.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, "").trim();

  if (token.length < 10) {
    res.status(400).json({ error: "invalid token" });
    return;
  }

  if (!/^[A-Za-z0-9._~+/=-]+$/.test(token)) {
    res.status(400).json({
      error: "Некорректный токен. Скопируйте только значение access_token из адресной строки после # (только латинские буквы и цифры).",
    });
    return;
  }

  try {
    await fetchYandexUserInfo(token);
  } catch (err) {
    if (err instanceof YandexApiError && (err.status === 401 || err.status === 403)) {
      res.status(400).json({
        error: "Токен отклонён Яндексом. Проверьте, что скопирован access_token, а не Client ID.",
      });
      return;
    }

    req.log.warn({ err }, "Failed to verify the Yandex token");
    res.status(502).json({
      error: "Не удалось проверить токен в Яндекс API. Попробуйте ещё раз.",
    });
    return;
  }

  const status = setYandexToken(token);
  req.log.info({ updatedAt: status.updatedAt }, "Yandex token stored in the server vault");
  res.json(status);
});

router.delete("/yandex/token", writeLimiter(), (_req, res) => {
  const status = setYandexToken(null);
  closeAllClients(4001, "Yandex token removed");
  res.json(status);
});

export default router;
