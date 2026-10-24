import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DiagnosticCheck } from "./hooks/use-engineering-data";
import { getDeviceIcon, type Device } from "@/lib/yandex";
import { AlertTriangle, CheckCircle, Send, TestTube } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DiagnosticsTabProps {
  diagnostics: DiagnosticCheck[];
  devices: Device[];
  token: string;
}

export function DiagnosticsTab({ diagnostics, devices, token }: DiagnosticsTabProps) {
  return (
    <div className="space-y-6">
      {/* Diagnostic checks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Проверки целостности
        </h3>
        <div className="space-y-2">
          {diagnostics.map((check) => (
            <div
              key={check.id}
              className="bg-card border border-border/50 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                {check.status === "ok" ? (
                  <CheckCircle className="w-4 h-4 text-[hsl(var(--gold))]" />
                ) : check.status === "warning" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                )}
                <span className="text-sm font-medium">{check.label}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    check.status === "ok"
                      ? "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30"
                      : check.status === "warning"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-destructive/20 text-destructive border-destructive/30"
                  }`}
                >
                  {check.status === "ok" ? "OK" : `${check.items.length}`}
                </Badge>
              </div>
              {check.items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {check.items.slice(0, 10).map((item, i) => (
                    <p key={i} className="text-xs text-muted-foreground font-mono pl-6">
                      {item}
                    </p>
                  ))}
                  {check.items.length > 10 && (
                    <p className="text-xs text-muted-foreground pl-6">
                      … и ещё {check.items.length - 10}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Test Mode */}
      <TestMode devices={devices} token={token} />
    </div>
  );
}

function TestMode({ devices, token }: { devices: Device[]; token: string }) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [capType, setCapType] = useState("devices.capabilities.on_off");
  const [instance, setInstance] = useState("on");
  const [value, setValue] = useState("true");
  const [resultLog, setResultLog] = useState<string[]>([]);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  const sendCommand = useCallback(() => {
    if (!selectedDeviceId) {
      toast({ variant: "destructive", title: "Ошибка", description: "Выберите устройство" });
      return;
    }

    let parsedValue: any = value;
    if (value === "true") parsedValue = true;
    else if (value === "false") parsedValue = false;
    else if (!isNaN(Number(value))) parsedValue = Number(value);

    const action = {
      type: capType,
      state: { instance, value: parsedValue },
    };

    controlDevice.mutate(
      { deviceId: selectedDeviceId, data: { actions: [action] } },
      {
        onSuccess: (data) => {
          const msg = `✓ ${new Date().toLocaleTimeString("ru-RU")} → ${selectedDevice?.name}: ${JSON.stringify(action)} → ${JSON.stringify(data)}`;
          setResultLog((prev) => [...prev.slice(-50), msg]);
          queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        },
        onError: (err) => {
          const msg = `✗ ${new Date().toLocaleTimeString("ru-RU")} → ${selectedDevice?.name}: ${err.message}`;
          setResultLog((prev) => [...prev.slice(-50), msg]);
        },
      }
    );
  }, [selectedDeviceId, capType, instance, value, controlDevice, selectedDevice, queryClient]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <TestTube className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Тестовый режим
        </h3>
      </div>
      <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
        {/* Device selector */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Устройство</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-border/50 bg-card text-foreground mt-1"
          >
            <option value="">Выберите устройство</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {getDeviceIcon(d.type)} {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Capability type */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Тип свойства</label>
          <Input
            value={capType}
            onChange={(e) => setCapType(e.target.value)}
            className="h-8 text-xs font-mono mt-1 bg-card border-border"
          />
        </div>

        {/* Instance + Value */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Экземпляр</label>
            <Input
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              className="h-8 text-xs font-mono mt-1 bg-card border-border"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Значение</label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 text-xs font-mono mt-1 bg-card border-border"
              placeholder="true / false / число"
            />
          </div>
        </div>

        <Button
          onClick={sendCommand}
          disabled={controlDevice.isPending || !selectedDeviceId}
          size="sm"
          className="w-full"
        >
          <Send className="w-3.5 h-3.5 mr-1.5" />
          {controlDevice.isPending ? "Отправка..." : "Отправить команду"}
        </Button>

        {/* Result log */}
        {resultLog.length > 0 && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              Журнал команд
            </label>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {resultLog.map((log, i) => (
                  <p key={i} className={`text-[10px] font-mono ${log.startsWith("✓") ? "text-[hsl(var(--gold))]" : "text-destructive"}`}>
                    {log}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
