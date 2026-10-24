import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenForm } from "@/components/token-form";
import { useWebSocket } from "@/hooks/use-websocket";
import { getUserInfoKey } from "@/lib/query-keys";
import { toast } from "@/hooks/use-toast";
import { useEngineeringData } from "./hooks/use-engineering-data";
import { useEventLog } from "./hooks/use-event-log";
import { usePerformance } from "./hooks/use-performance";
import { useApiMonitor } from "./hooks/use-api-monitor";
import { OverviewTab } from "./overview-tab";
import { RoomsTab } from "./rooms-tab";
import { ScenariosTab } from "./scenarios-tab";
import { AutomationsTab } from "./automations-tab";
import { useEngine } from "./hooks/use-engine";
import { LogsTab } from "./logs-tab";
import { NetworkTab } from "./network-tab";
import { ApiMonitorTab } from "./api-monitor-tab";
import { PerformanceTab } from "./performance-tab";
import { DiagnosticsTab } from "./diagnostics-tab";
import { LayoutTab } from "./layout-tab";
import { CardsTab } from "./cards-tab";
import { RawDataDialog } from "./components/raw-data-dialog";
import { useScenarioVisibility } from "@/hooks/use-scenario-visibility";
import {
  Wifi,
  WifiOff,
  LogOut,
  Home,
  EyeOff,
  Smartphone,
  Database,
} from "lucide-react";
import { getDeviceIcon } from "@/lib/yandex";

export default function EngineeringPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const data = useEngineeringData();
  const eventLog = useEventLog();
  const apiMonitor = useApiMonitor(activeTab === "api");
  const scenarioVisibility = useScenarioVisibility();
  const engine = useEngine();
  const [rawDataOpen, setRawDataOpen] = useState(false);

  // WebSocket for event log
  const { isConnected: wsConnected } = useWebSocket({
    token: data.token ?? "",
    onMessage: (msg) => {
      if (msg.type === "device_update") {
        eventLog.addEntry({
          type: "device_update",
          deviceId: msg.deviceId as string,
          message: `Состояние устройства ${msg.deviceId} обновлено`,
          details: msg as any,
        });
      } else if (msg.type === "scenario_run") {
        eventLog.addEntry({
          type: "scenario_run",
          deviceId: msg.scenarioId as string,
          message: `Сценарий ${msg.scenarioId} выполнен`,
          details: msg as any,
        });
      } else if (msg.type === "engine_state") {
        queryClient.invalidateQueries({ queryKey: ["engine", "state"] });
      } else if (msg.type === "device_changed") {
        queryClient.invalidateQueries({ queryKey: getUserInfoKey(data.token) });
      }
    },
  });

  const perf = usePerformance(queryClient, wsConnected, activeTab === "performance");

  if (!data.isLoaded) return null;

  if (!data.token) {
    return (
      <div className="p-4">
        <TokenForm onSave={data.setToken} />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-screen-2xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`flex items-center gap-1.5 text-xs ${
              data.isConnected ? "text-[hsl(var(--gold))]" : "text-muted-foreground"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                data.isConnected ? "bg-[hsl(var(--gold))] animate-pulse" : "bg-muted-foreground"
              }`}
            />
            {data.isConnected ? (
              <Wifi key="wifi" className="w-3.5 h-3.5" />
            ) : (
              <WifiOff key="wifioff" className="w-3.5 h-3.5" />
            )}
            {data.isConnected
              ? "Подключено"
              : data.userInfoQuery.isLoading
                ? "Подключение..."
                : "Отключено"}
          </span>
          {wsConnected && (
            <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--gold))]/70">
              WS
            </span>
          )}
          {data.activeCount > 0 && (
            <Badge className="bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30 text-xs font-mono">
              {data.activeCount} активно
            </Badge>
          )}
          {data.hiddenDeviceIds.size > 0 && (
            <button
              onClick={() => data.setShowHidden(!data.showHidden)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                data.showHidden
                  ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                  : "border-border/50 text-muted-foreground hover:border-border"
              }`}
              title="Скрытые устройства"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Скрыто: {data.hiddenDeviceIds.size}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void data.setToken(null).catch((err) => {
                toast({
                  variant: "destructive",
                  title: "Не удалось удалить токен",
                  description: err instanceof Error ? err.message : String(err),
                });
              });
            }}
            className="text-muted-foreground hover:text-destructive h-8"
            title="Отключиться"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {data.userInfoQuery.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {data.userInfoQuery.isError && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 mb-6 text-sm text-destructive">
          Не удалось подключиться. Проверьте токен.
        </div>
      )}

      {data.isConnected && (
        <>
          {/* Household tabs */}
          {data.households.length > 0 && (
            <div className="flex gap-2 mb-5 flex-wrap">
              {data.households.map((hh: any) => (
                <div key={hh.id} className="flex items-center gap-1">
                  <button
                    onClick={() => data.setSelectedHouseholdId(hh.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                      data.selectedHouseholdId === hh.id || (!data.selectedHouseholdId && data.households[0]?.id === hh.id)
                        ? "bg-[hsl(var(--gold))] text-background border-[hsl(var(--gold))] scale-105 shadow-md shadow-[hsl(var(--gold))]/20"
                        : "bg-card text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
                    }`}
                  >
                    {hh.name}
                  </button>
                  <button
                    onClick={() => window.open(`/panel/${hh.id}`, "_blank")}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10 border border-border/30 hover:border-[hsl(var(--gold))]/40 transition-colors"
                    title={`Открыть панель пользователя: ${hh.name}`}
                  >
                    <Home className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => window.open(`/mobile/${hh.id}`, "_blank")}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10 border border-border/30 hover:border-[hsl(var(--gold))]/40 transition-colors"
                    title={`Открыть мобильную панель: ${hh.name}`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden devices panel */}
          {data.showHidden && data.hiddenDeviceIds.size > 0 && (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-amber-400">
                  Скрытые устройства ({data.hiddenDeviceIds.size})
                </h3>
                <button
                  onClick={data.restoreAll}
                  className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/40 hover:border-amber-400/60 px-2.5 py-1 rounded-md transition-colors"
                >
                  Показать все
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {data.allDevices
                  .filter((d: any) => data.hiddenDeviceIds.has(d.id))
                  .map((device: any) => (
                    <div
                      key={device.id}
                      className="flex items-center gap-2 bg-card border border-border/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-lg">{getDeviceIcon((device as any).type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{device.name}</p>
                      </div>
                      <button
                        onClick={() => data.restoreDevice(device.id)}
                        className="text-xs text-amber-400 hover:text-amber-300 flex-shrink-0 border border-amber-500/30 hover:border-amber-400/50 px-2 py-0.5 rounded transition-colors"
                      >
                        ↩ Вернуть
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Main tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 h-auto flex-wrap gap-1 bg-muted/30 p-1">
              <TabsTrigger value="overview" className="text-xs">Обзор</TabsTrigger>
              <TabsTrigger value="rooms" className="text-xs">Комнаты</TabsTrigger>
              <TabsTrigger value="layout" className="text-xs">Сетка</TabsTrigger>
              <TabsTrigger value="cards" className="text-xs">Карточки</TabsTrigger>
              <TabsTrigger value="scenarios" className="text-xs">Сценарии</TabsTrigger>
              <TabsTrigger value="automations" className="text-xs">Автоматизации</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs">
                Журнал
                {eventLog.allEntries.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] font-mono">{eventLog.allEntries.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="network" className="text-xs">Сеть</TabsTrigger>
              <TabsTrigger value="api" className="text-xs">API</TabsTrigger>
              <TabsTrigger value="performance" className="text-xs">Перформанс</TabsTrigger>
              <TabsTrigger value="diagnostics" className="text-xs">Диагностика</TabsTrigger>
            </TabsList>

            {/* Raw data row — immediately after Диагностика */}
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRawDataOpen(true)}
                className="h-8 text-xs gap-1.5 border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                title="Показать сырые данные по всем устройствам и скопировать"
              >
                <Database className="w-3.5 h-3.5" />
                Сырые данные
              </Button>
            </div>

            <TabsContent value="overview">
              <OverviewTab
                stats={data.stats}
                households={data.households}
                rooms={data.rooms as any[]}
                devices={data.householdDevices as any}
                selectedHouseholdId={data.selectedHouseholdId}
              />
            </TabsContent>

            <TabsContent value="rooms">
              <RoomsTab
                rooms={data.rooms as any[]}
                devices={data.householdDevices as any}
                token={data.token!}
                hideOffline={data.hideOffline}
                hiddenIds={data.hiddenDeviceIds}
                onHide={data.hideDevice}
              />
            </TabsContent>

            <TabsContent value="layout">
              <LayoutTab
                rooms={(data.rooms as any[]) ?? []}
                devices={(data.allDevices as any[]) ?? []}
                scenarios={(data.scenariosQuery.data?.scenarios ?? []) as any}
                token={data.token!}
              />
            </TabsContent>

            <TabsContent value="cards">
              <CardsTab
                devices={(data.householdDevices as any[]) ?? []}
                token={data.token!}
              />
            </TabsContent>

            <TabsContent value="scenarios">
              <ScenariosTab
                scenarios={(data.scenariosQuery.data?.scenarios ?? []) as any}
                rooms={(data.rooms as any[]) ?? []}
                onRun={data.handleRunScenario}
                isPending={data.scenariosQuery.isLoading}
                error={data.scenariosQuery.error as Error | null}
                isScenarioVisible={scenarioVisibility.isScenarioVisible}
                onToggleVisible={scenarioVisibility.setScenarioVisible}
                getScenarioRooms={scenarioVisibility.getScenarioRooms}
                onToggleScenarioRoom={scenarioVisibility.toggleScenarioRoom}
                onSetAllRooms={scenarioVisibility.setScenarioAllRooms}
              />
            </TabsContent>

            <TabsContent value="automations">
              {engine.stateQuery.isError ? (
                <p className="text-sm text-destructive py-8 text-center">
                  Ошибка загрузки состояния движка
                </p>
              ) : engine.stateQuery.data ? (
                <AutomationsTab
                  engine={engine}
                  state={engine.stateQuery.data}
                  devices={(data.allDevices as any[]) ?? []}
                  prefillToken={data.token ?? ""}
                />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Загрузка состояния движка...
                </p>
              )}
            </TabsContent>

            <TabsContent value="logs">
              <LogsTab
                entries={eventLog.entries}
                filter={eventLog.filter}
                onFilterChange={eventLog.setFilter}
                onClear={eventLog.clear}
                onExport={eventLog.exportJSON}
              />
            </TabsContent>

            <TabsContent value="network">
              <NetworkTab
                protocolGroups={data.protocolGroups}
                totalDevices={data.householdDevices.length}
              />
            </TabsContent>

            <TabsContent value="api">
              <ApiMonitorTab
                requests={apiMonitor.requests}
                stats={apiMonitor.stats}
                onClear={apiMonitor.clear}
              />
            </TabsContent>

            <TabsContent value="performance">
              <PerformanceTab
                metrics={perf.metrics}
                onRefresh={perf.refresh}
              />
            </TabsContent>

            <TabsContent value="diagnostics">
              <DiagnosticsTab
                diagnostics={data.diagnostics}
                devices={data.householdDevices as any}
                token={data.token!}
              />
            </TabsContent>
          </Tabs>

          <RawDataDialog
            token={data.token!}
            open={rawDataOpen}
            onOpenChange={setRawDataOpen}
          />
        </>
      )}
    </div>
  );
}
