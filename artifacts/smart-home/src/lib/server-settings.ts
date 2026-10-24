const SETTINGS_BASE = "/api/settings";

/** Загрузить значение настройки с сервера (null — нет данных) */
export async function loadServerSetting<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`${SETTINGS_BASE}/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data === null || data === undefined) return null;
    return data as T;
  } catch {
    return null;
  }
}

/** Сохранить значение настройки на сервер (дебаунс на стороне вызова) */
export async function saveServerSetting(key: string, value: unknown): Promise<boolean> {
  try {
    const res = await fetch(SETTINGS_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Удалить настройку с сервера */
export async function deleteServerSetting(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${SETTINGS_BASE}/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}