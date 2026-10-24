import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUserInfo,
  useControlDevice,
  useRunScenario,
} from "@workspace/api-client-react";
import { useYandexToken } from "@/hooks/use-yandex-token";
import { getUserInfoKey } from "@/lib/query-keys";
import {
  isDeviceReporting,
  type Device,
} from "@/lib/yandex";
import { toast } from "@/hooks/use-toast";

const HIDDEN_ENG_KEY = "hidden_eng_devices_v1";

export interface EngineeringStats {
  total: number;
  active: number;
  offline: number;
  withCapabilities: number;
  withoutCapabilities: number;
  lastSync: Date | null;
}

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: "ok" | "warning" | "error";
  items: string[];
}

export function useEngineeringData() {
  const { token, setToken, isLoaded } = useYandexToken();
  const [search, setSearch] = useState("");
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [hideOffline, setHideOffline] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenDeviceIds, setHiddenDeviceIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(HIDDEN_ENG_KEY);
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    localStorage.setItem(HIDDEN_ENG_KEY, JSON.stringify([...hiddenDeviceIds]));
    // Синхронизация скрытых устройств на той же вкладке (ЮМП слушает этот event)
    window.dispatchEvent(new Event("engineering-devices-hidden"));
  }, [hiddenDeviceIds]);

  const hideDevice = useCallback((id: string) => {
    setHiddenDeviceIds((prev) => new Set([...prev, id]));
  }, []);

  const restoreDevice = useCallback((id: string) => {
    setHiddenDeviceIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const restoreAll = useCallback(() => setHiddenDeviceIds(new Set()), []);

  const queryClient = useQueryClient();

  const runScenario = useRunScenario({
    request: { headers: { "x-yandex-token": token ?? "" } },
  });

  const userInfoQuery = useGetUserInfo({
    request: { headers: { "x-yandex-token": token ?? "" } },
    query: { enabled: !!token, queryKey: getUserInfoKey(token), staleTime: 30_000 },
  });

  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token ?? "" } },
  });

  const userInfo = userInfoQuery.data;
  const isConnected = !!userInfo && userInfo.status === "ok";

  const households = useMemo(() => userInfo?.households ?? [], [userInfo]);
  const allRooms = useMemo(() => userInfo?.rooms ?? [], [userInfo]);
  const allDevices = useMemo(() => userInfo?.devices ?? [], [userInfo]);

  const effectiveHouseholdId = selectedHouseholdId ?? households[0]?.id ?? null;

  const rooms = useMemo(
    () =>
      effectiveHouseholdId
        ? allRooms.filter((r: any) => r.household_id === effectiveHouseholdId)
        : allRooms,
    [allRooms, effectiveHouseholdId]
  );

  const householdDevices = useMemo(
    () =>
      effectiveHouseholdId
        ? allDevices.filter((d: any) => d.household_id === effectiveHouseholdId)
        : allDevices,
    [allDevices, effectiveHouseholdId]
  );

  const filteredDevices = useMemo(() => {
    let devices = householdDevices;
    if (search) {
      const q = search.toLowerCase();
      devices = householdDevices.filter(
        (d: any) => d.name?.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q)
      );
    }
    return [...devices].sort((a: any, b: any) => {
      const typeCompare = (a.type ?? "").localeCompare(b.type ?? "");
      if (typeCompare !== 0) return typeCompare;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [householdDevices, search]);

  const visibleDevices = useMemo(
    () => filteredDevices.filter((d: any) => !hiddenDeviceIds.has(d.id)),
    [filteredDevices, hiddenDeviceIds]
  );

  const activeCount = useMemo(() => householdDevices.filter(isDeviceReporting).length, [householdDevices]);

  const unroomedDevices = useMemo(
    () =>
      visibleDevices.filter(
        (d: any) => !d.room_id || !rooms.find((r: any) => r.id === d.room_id)
      ),
    [visibleDevices, rooms]
  );

  const stats = useMemo<EngineeringStats>(() => {
    return {
      total: householdDevices.length,
      active: activeCount,
      offline: householdDevices.length - activeCount,
      withCapabilities: householdDevices.filter((d: any) => d.capabilities && d.capabilities.length > 0).length,
      withoutCapabilities: householdDevices.filter((d: any) => !d.capabilities || d.capabilities.length === 0).length,
      lastSync: userInfoQuery.dataUpdatedAt ? new Date(userInfoQuery.dataUpdatedAt) : null,
    };
  }, [householdDevices, activeCount, userInfoQuery.dataUpdatedAt]);

  const protocolGroups = useMemo(() => {
    const groups = new Map<string, Device[]>();
    for (const d of householdDevices) {
      const protocol = deriveProtocol(d as Device);
      const arr = groups.get(protocol) ?? [];
      arr.push(d as Device);
      groups.set(protocol, arr);
    }
    return groups;
  }, [householdDevices]);

  const diagnostics = useMemo<DiagnosticCheck[]>(() => {
    const orphanDevices = visibleDevices.filter(
      (d: any) => !d.room_id || !rooms.find((r: any) => r.id === d.room_id)
    );
    const noCapDevices = householdDevices.filter(
      (d: any) => !d.capabilities || d.capabilities.length === 0
    );
    const capsNoState = householdDevices.flatMap((d: any) =>
      (d.capabilities ?? [])
        .filter((c: any) => c.state === null || c.state === undefined)
        .map((c: any) => `${d.name}: ${c.type}`)
    );

    return [
      {
        id: "orphan-devices",
        label: "Устройства без комнаты",
        status: orphanDevices.length > 0 ? "warning" : "ok",
        items: orphanDevices.map((d: any) => `${d.name} (${d.id})`),
      },
      {
        id: "no-capabilities",
        label: "Устройства без свойств",
        status: noCapDevices.length > 0 ? "warning" : "ok",
        items: noCapDevices.map((d: any) => d.name),
      },
      {
        id: "no-state",
        label: "Свойства без состояния",
        status: capsNoState.length > 0 ? "error" : "ok",
        items: capsNoState,
      },
    ];
  }, [visibleDevices, householdDevices, rooms]);

  const handleRunScenario = useCallback(
    (scenarioId: string) => {
      runScenario.mutate(
        { scenarioId },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }) }
      );
    },
    [runScenario, queryClient]
  );

  const handleExportRawData = useCallback(async () => {
    if (!token) {
      toast({ variant: "destructive", title: "Ошибка", description: "Токен не задан" });
      return;
    }
    toast({ variant: "default", title: "Экспорт...", description: "Загрузка данных с Yandex API" });
    try {
      const response = await fetch("/api/yandex/raw-export", {
        headers: { "x-yandex-token": token },
      });
      const text = await response.text();
      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const err = JSON.parse(text);
          errorMsg = err.error || errorMsg;
        } catch {}
        toast({ variant: "destructive", title: "Ошибка сервера", description: errorMsg });
        return;
      }
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yandex-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ variant: "success", title: "Экспорт завершён", description: `Файл скачан (${(blob.size / 1024).toFixed(1)} КБ)` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ошибка сети", description: err?.message || "Не удалось подключиться к серверу" });
    }
  }, [token]);

  return {
    token,
    setToken,
    isLoaded,
    isConnected,
    search,
    setSearch,
    selectedHouseholdId,
    setSelectedHouseholdId,
    hideOffline,
    setHideOffline,
    showHidden,
    setShowHidden,
    hiddenDeviceIds,
    hideDevice,
    restoreDevice,
    restoreAll,
    households,
    rooms,
    allDevices,
    householdDevices,
    filteredDevices,
    visibleDevices,
    activeCount,
    unroomedDevices,
    stats,
    protocolGroups,
    diagnostics,
    userInfoQuery,
    scenariosQuery: { data: { scenarios: userInfo?.scenarios ?? [] }, isLoading: userInfoQuery.isLoading, error: userInfoQuery.error },
    controlDevice,
    handleRunScenario,
    handleExportRawData,
  };
}

function deriveProtocol(d: Device): string {
  if ((d as any).quasar_info) return "Quasar";
  if (d.type.startsWith("devices.types.sensor")) return "Zigbee";
  if (d.type.includes("media_device") || d.type.includes("camera")) return "Cloud";
  return "WiFi";
}
