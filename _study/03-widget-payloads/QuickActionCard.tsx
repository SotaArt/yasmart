import { useQueryClient } from "@tanstack/react-query";
import { useRunScenario, useControlDevice } from "@workspace/api-client-react";
import { getUserInfoKey } from "@/lib/query-keys";
import { SmartCard, type CardSize } from "./SmartCard";
import { toast } from "@/hooks/use-toast";
import type { QuickAction } from "@/hooks/use-panel-config";

interface QuickActionCardProps {
  quickAction: QuickAction;
  token: string;
  size: CardSize;
  onDelete?: () => void;
}

export function QuickActionCard({ quickAction, token, size, onDelete }: QuickActionCardProps) {
  const queryClient = useQueryClient();
  const runScenario = useRunScenario({
    request: { headers: { "x-yandex-token": token } },
  });
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const handleExecute = () => {
    if (quickAction.sceneId) {
      runScenario.mutate(
        { scenarioId: quickAction.sceneId },
        {
          onSuccess: () => {
            toast({ variant: "success", title: "Действие выполнено", description: quickAction.name });
            queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
          },
          onError: () => {
            toast({ variant: "destructive", title: "Ошибка", description: `Не удалось выполнить "${quickAction.name}"` });
          },
        }
      );
      return;
    }

    const actions = quickAction.actions;
    if (actions && actions.length > 0) {
      void (async () => {
        try {
          for (const action of actions) {
            await controlDevice.mutateAsync({
              deviceId: action.deviceId,
              data: {
                actions: [{
                  type: typeof action.value === "boolean" ? "devices.capabilities.on_off" : "devices.capabilities.range",
                  state: {
                    instance: typeof action.value === "boolean" ? "on" : "brightness",
                    value: action.value,
                  },
                }],
              },
            });
          }
          toast({ variant: "success", title: "Действие выполнено", description: quickAction.name });
          queryClient.invalidateQueries({ queryKey: getUserInfoKey(token) });
        } catch {
          toast({ variant: "destructive", title: "Ошибка", description: `Часть действий не выполнена` });
        }
      })();
    }
  };

  return (
    <SmartCard
      size={size}
      variant="scene"
      active={false}
      onClick={handleExecute}
      data-testid={`quick-action-${quickAction.id}`}
    >
      <SmartCard.Header icon={quickAction.icon} name={quickAction.name} />

      <SmartCard.Primary>
        ▶ Выполнить
      </SmartCard.Primary>

      {size !== "compact" && (
        <div className="mt-1">
          <span className="text-[10px] text-muted-foreground">
            {quickAction.sceneId ? "Сценарий" : `${quickAction.actions?.length ?? 0} действий`}
          </span>
        </div>
      )}
    </SmartCard>
  );
}
