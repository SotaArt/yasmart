import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Cpu,
  History,
  Key,
  Play,
  RefreshCcw,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { useEngine } from "./hooks/use-engine";
import { HOME_MODES, type EngineState } from "@/lib/engine-api";
import { ClimateSettingsDialog } from "./climate-settings-dialog";

interface AutomationsTabProps {
  engine: ReturnType<typeof useEngine>;
  state: EngineState;
  devices: any[];
  prefillToken: string;
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} с назад`;
  if (s < 3600) return `${Math.round(s / 60)} мин назад`;
  return `${Math.round(s / 3600)} ч назад`;
}

function fmtDuration(ms: number): string {
  if (ms >= 3600_000) return `${Math.round(ms / 3_600_000)} ч`;
  if (ms >= 60_000) return `${Math.round(ms / 60_000)} мин`;
  return `${Math.round(ms / 1000)} с`;
}

export function AutomationsTab({ engine, state, devices, prefillToken }: AutomationsTabProps) {
  const [tokenDraft, setTokenDraft] = useState(prefillToken ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const hasServerToken = !!state.token;

  const editingScenario = editingId ? state.scenarios.find((s) => s.id === editingId) : undefined;

  return (
    <div className="space-y-4 py-2">
      {/* ── Заголовок: состояние движка ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-card border border-border/50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-[hsl(var(--gold))]" />
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              Движок сценариев
              <Switch
                checked={state.enabled}
                onCheckedChange={(v) => engine.setEnabled.mutate(v)}
              />
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              цикл каждые {fmtDuration(state.pollIntervalMs)} · запусков: {state.runCount} · обновление: {fmtAgo(state.lastRun)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {HOME_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => engine.setPresence.mutate(m.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  state.presence === m.value
                    ? "bg-[hsl(var(--gold))] text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => engine.refresh()}
            title="Принудительный цикл"
            className="border-border/70 hover:border-primary/50 hover:text-primary"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Серверный токен ── */}
      <div className="bg-card border border-border/50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Токен движка (серверный)</p>
        </div>
        {hasServerToken ? (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 mr-2">Сохранён</Badge>
              Фоновый цикл использует токен, сохранённый на сервере. Устройства для сценариев не требуют токена в браузере.
            </p>
            <Button variant="ghost" size="sm" onClick={() => engine.deleteToken.mutate()} className="text-muted-foreground hover:text-destructive">
              Удалить токен
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="Вставьте токен Яндекса для движка"
              className="flex-1 font-mono text-xs"
              type="password"
            />
            <Button size="sm" onClick={() => tokenDraft && engine.saveToken.mutate(tokenDraft)} disabled={!tokenDraft}>
              Сохранить
            </Button>
          </div>
        )}
      </div>

      {/* ── Сценарии ── */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 px-1">
          Сценарии · {state.scenarios.filter((s) => s.enabled).length} из {state.scenarios.length} активны
        </p>
        <div className="space-y-2">
          {state.scenarios.map((sc) => (
            <div key={sc.id} className="bg-card border border-border/50 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Cpu className="w-4 h-4 text-[hsl(var(--gold))] flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{sc.name}</p>
                    <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground border-border/50">
                      {sc.kind === "climate" ? "Климат" : sc.kind === "auto" ? "Авто" : "Ручной"}
                    </Badge>
                    {sc.poll && <Badge variant="outline" className="text-[10px] text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/10">цикл</Badge>}
                  </div>
                  {sc.description && <p className="text-[11px] text-muted-foreground truncate max-w-[420px]">{sc.description}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  checked={sc.enabled}
                  onCheckedChange={(v) => engine.setScenarioEnabled.mutate({ id: sc.id, enabled: v })}
                />
                {sc.kind === "climate" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(sc.id)}
                    className="border-border/70 text-muted-foreground hover:text-primary hover:border-primary/50"
                  >
                    <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                    Настроить
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => engine.runScenario.mutate(sc.id)}
                  disabled={!hasServerToken}
                  className="border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                  title="Ручной запуск (мгновенный цикл сценария)"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Вручную
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ручные переопределения ── */}
      <div className="bg-card border border-border/50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Ручное управление</p>
          <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground border-border/50">
            {state.overrides.length}
          </Badge>
        </div>
        {state.overrides.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Нет активных переопределений — движок полностью управляет устройствами.
          </p>
        ) : (
          <div className="space-y-1.5">
            {state.overrides.map((o) => (
              <div key={o.deviceId} className="flex items-center justify-between gap-3 bg-muted/40 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium">{o.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{o.reason} · с {fmtTime(o.since)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => engine.clearOverride.mutate(o.deviceId)} className="text-xs text-muted-foreground hover:text-destructive">
                  Снять
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Журнал движка ── */}
      <div className="bg-card border border-border/50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Журнал движка</p>
        </div>
        <ScrollArea className="h-[300px] rounded-lg border border-border/30 bg-black/20">
          <div className="space-y-px p-2 font-mono text-[11px]">
            {engine.historyQuery.data && engine.historyQuery.data.length > 0 ? (
              [...engine.historyQuery.data].reverse().map((e, i) => (
                <div
                  key={`${e.ts}-${i}`}
                  className={`flex items-start gap-2 px-2 py-1 rounded ${levelColor(e.level)}`}
                >
                  <span className="text-muted-foreground flex-shrink-0">{fmtTime(e.ts)}</span>
                  <span className="flex-shrink-0">
                    {e.level === "error" ? "✖" : e.level === "warn" ? "⚠" : "·"}
                  </span>
                  <span className="flex-shrink-0 text-[hsl(var(--gold))]">{e.scenarioId ?? "—"}</span>
                  <span className="break-words">{e.message}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground p-2">Журнал пуст</p>
            )}
          </div>
        </ScrollArea>
        {!state.enabled && (
          <p className="flex items-center gap-1.5 text-xs text-amber-500 mt-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Движок остановлен — фоновый цикл не выполняется.
          </p>
        )}
      </div>

      {editingScenario && editingScenario.kind === "climate" && (
        <ClimateSettingsDialog
          scenario={editingScenario}
          devices={devices}
          open={!!editingScenario}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSave={(patch) => {
            engine.updateScenario.mutate({ id: editingScenario.id, patch });
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function levelColor(level: string): string {
  switch (level) {
    case "error":
      return "bg-destructive/10 text-destructive";
    case "warn":
      return "bg-amber-500/10 text-amber-400";
    default:
      return "text-foreground/80";
  }
}