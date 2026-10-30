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
import { OverviewTab } from "./overview-tab";
import { RoomsTab } from "./rooms-tab";
import { ScenariosTab } from "./scenarios-tab";
import { AutomationsTab } from "./automations-tab";
import { WidgetsTab } from "./widgets-tab";
import { useEngine } from "./hooks/use-engine";
import { useScenarioVisibility } from "@/hooks/use-scenario-visibility";
import {
  Wifi,
  WifiOff,
  LogOut,
  Home,
  Smartphone,
} from "lucide-react";

export default function EngineeringPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const data = useEngineeringData();
  const scenarioVisibility = useScenarioVisibility();
  const engine = useEngine();

  // WebSocket for live engine/device updates
  const { isConnected: wsConnected } = useWebSocket({
    token: data.token ?? "",
    onMessage: (msg) => {
      if (msg.type === "engine_state") {
        queryClient.invalidateQueries({ queryKey: ["engine", "state"] });
      } else if (msg.type === "device_changed") {
        queryClient.invalidateQueries({ queryKey: getUserInfoKey(data.token) });
      }
    },
  });


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
            <Wifi className={`w-3.5 h-3.5 ${data.isConnected ? "" : "hidden"}`} />
            <WifiOff className={`w-3.5 h-3.5 ${data.isConnected ? "hidden" : ""}`} />
            <span>
              {data.isConnected
                ? "Подключено"
                : data.userInfoQuery.isLoading
                  ? "Подключение..."
                  : "Отключено"}
            </span>
          </span>
          <span className={`flex items-center gap-1 text-[10px] text-[hsl(var(--gold))]/70 ${wsConnected ? "" : "hidden"}`}>
            WS
          </span>
          <Badge
            className={`bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30 text-xs font-mono ${
              data.activeCount > 0 ? "" : "hidden"
            }`}
          >
            {data.activeCount} активно
          </Badge>
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

          {/* Main tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 h-auto flex-wrap gap-1 bg-muted/30 p-1">
              <TabsTrigger value="overview" className="text-xs">Обзор</TabsTrigger>
              <TabsTrigger value="rooms" className="text-xs">Комнаты</TabsTrigger>
              <TabsTrigger value="scenarios" className="text-xs">Сценарии</TabsTrigger>
              <TabsTrigger value="widgets" className="text-xs">Виджеты</TabsTrigger>
              <TabsTrigger value="automations" className="text-xs">Автоматизации</TabsTrigger>
            </TabsList>

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

            <TabsContent value="widgets">
              <WidgetsTab rooms={(data.rooms as any[]) ?? []} />
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

          </Tabs>
        </>
      )}
    </div>
  );
}
