import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { engineApi, type HomeMode } from "@/lib/engine-api";
import { toast } from "@/hooks/use-toast";

export const ENGINE_STATE_KEY = ["engine", "state"];
export const ENGINE_HISTORY_KEY = ["engine", "history"];

export function useEngine() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const sync = () => {
      void queryClient.invalidateQueries({ queryKey: ENGINE_STATE_KEY });
    };
    window.addEventListener("yandex-token-changed", sync);
    return () => window.removeEventListener("yandex-token-changed", sync);
  }, [queryClient]);

  const stateQuery = useQuery({
    queryKey: ENGINE_STATE_KEY,
    queryFn: () => engineApi.state(),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const historyQuery = useQuery({
    queryKey: ENGINE_HISTORY_KEY,
    queryFn: () => engineApi.history(100),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ENGINE_STATE_KEY });
    queryClient.invalidateQueries({ queryKey: ENGINE_HISTORY_KEY });
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ENGINE_STATE_KEY }),
      queryClient.refetchQueries({ queryKey: ENGINE_HISTORY_KEY }),
    ]);
  };

  const setEnabled = useMutation({
    mutationFn: (enabled: boolean) => engineApi.setEnabled(enabled),
    onSuccess: () => {
      invalidate();
      toast({ title: "Движок", description: "Состояние движка обновлено" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка", description: err?.message }),
  });

  const setPresence = useMutation({
    mutationFn: (mode: HomeMode) => engineApi.setPresence(mode),
    onSuccess: () => invalidate(),
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка", description: err?.message }),
  });

  const saveToken = useMutation({
    mutationFn: (token: string) => engineApi.setToken(token),
    onSuccess: () => {
      invalidate();
      window.dispatchEvent(new Event("yandex-token-changed"));
      toast({ title: "Токен сохранён на сервере", description: "Фоновый цикл и панели используют его автоматически" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка", description: err?.message }),
  });

  const deleteToken = useMutation({
    mutationFn: () => engineApi.deleteToken(),
    onSuccess: () => {
      invalidate();
      window.dispatchEvent(new Event("yandex-token-changed"));
      toast({ title: "Токен удалён с сервера" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка", description: err?.message }),
  });

  const setScenarioEnabled = useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) =>
      engineApi.setScenarioEnabled(vars.id, vars.enabled),
    onSuccess: (_data, vars) => {
      invalidate();
      toast({
        title: vars.enabled ? "Сценарий включён" : "Сценарий выключен",
        description: `Фоновый цикл ${vars.enabled ? "включает" : "перестаёт учитывать"} этот сценарий`,
      });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка", description: err?.message }),
  });

  const runScenario = useMutation({
    mutationFn: (id: string) => engineApi.runScenario(id),
    onSuccess: (result) => {
      invalidate();
      const sent = (result as any)?.sent?.length ?? 0;
      const skipped = (result as any)?.skipped?.length ?? 0;
      toast({
        title: "Сценарий выполнен",
        description: `Отправлено команд: ${sent}, пропущено: ${skipped}`,
      });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка сценария", description: err?.message }),
  });

  const updateScenario = useMutation({
    mutationFn: (vars: { id: string; patch: any }) => engineApi.updateScenario(vars.id, vars.patch),
    onSuccess: () => {
      invalidate();
      toast({ title: "Конфигурация сохранена" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка", description: err?.message }),
  });

  const setOverride = useMutation({
    mutationFn: (vars: { deviceId: string; label: string; reason: string; ttlMs?: number }) =>
      engineApi.setOverride(vars.deviceId, vars.label, vars.reason, vars.ttlMs),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ручное управление установлено", description: "Движок не трогает устройство до снятия" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка", description: err?.message }),
  });

  const clearOverride = useMutation({
    mutationFn: (deviceId: string) => engineApi.clearOverride(deviceId),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ручное управление снято" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Ошибка", description: err?.message }),
  });

  return {
    stateQuery,
    historyQuery,
    refresh,
    setEnabled,
    setPresence,
    saveToken,
    deleteToken,
    setScenarioEnabled,
    runScenario,
    updateScenario,
    setOverride,
    clearOverride,
  };
}