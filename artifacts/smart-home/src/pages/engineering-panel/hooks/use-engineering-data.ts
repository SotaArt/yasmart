import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUserInfo,
  useControlDevice,
  useRunScenario,
} from "@workspace/api-client-react";
import { useYandexToken } from "@/hooks/use-yandex-token";
import { getUserInfoKey } from "@/lib/query-keys";
import { isDeviceReporting } from "@/lib/yandex";

export interface EngineeringStats {
  total: number;
  active: number;
  offline: number;
  withCapabilities: number;
  withoutCapabilities: number;
  lastSync: Date | null;
}

export function useEngineeringData() {
  const { token, setToken, isLoaded } = useYandexToken();
  const [search, setSearch] = useState("");
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [hideOffline, setHideOffline] = useState(false);
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

  const activeCount = useMemo(() => householdDevices.filter(isDeviceReporting).length, [householdDevices]);

  const unroomedDevices = useMemo(
    () =>
      filteredDevices.filter(
        (d: any) => !d.room_id || !rooms.find((r: any) => r.id === d.room_id)
      ),
    [filteredDevices, rooms]
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

  const handleRunScenario = useCallback(
    (scenarioId: string) => {
      runScenario.mutate(
        { scenarioId },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) }) }
      );
    },
    [runScenario, queryClient]
  );

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
    households,
    rooms,
    allDevices,
    householdDevices,
    filteredDevices,
    activeCount,
    unroomedDevices,
    stats,
    userInfoQuery,
    scenariosQuery: { data: { scenarios: userInfo?.scenarios ?? [] }, isLoading: userInfoQuery.isLoading, error: userInfoQuery.error },
    controlDevice,
    handleRunScenario,
  };
}
