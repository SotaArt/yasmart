import { useState } from "react";
import { useRunScenario } from "@workspace/api-client-react";
import { SmartCard, type CardSize } from "./SmartCard";
import { toast } from "@/hooks/use-toast";

interface SceneCardProps {
  scenario: {
    id: string;
    name: string;
    description?: string;
  };
  token: string;
  size: CardSize;
}

export function SceneCard({ scenario, token, size }: SceneCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const runScenario = useRunScenario({
    request: { headers: { "x-yandex-token": token } },
  });

  const handleRun = () => {
    if (isRunning) return;
    setIsRunning(true);
    runScenario.mutate(
      { scenarioId: scenario.id },
      {
        onSuccess: () => {
          setLastRun(new Date());
          setTimeout(() => setIsRunning(false), 1000);
          toast({ variant: "success", title: "Сценарий выполнен", description: scenario.name });
        },
        onError: () => {
          setIsRunning(false);
          toast({ variant: "destructive", title: "Ошибка", description: `Не удалось выполнить "${scenario.name}"` });
        },
      }
    );
  };

  return (
    <SmartCard
      size={size}
      variant="scene"
      active={isRunning}
      onClick={handleRun}
      data-testid={`tile-scenario-${scenario.id}`}
    >
      <SmartCard.Header icon="🎬" name={scenario.name} />

      <SmartCard.Primary>
        {isRunning ? "Выполняется..." : "Запустить"}
      </SmartCard.Primary>

      <SmartCard.Controls>
        {scenario.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-2">
            {scenario.description}
          </p>
        )}
      </SmartCard.Controls>

      <SmartCard.Meta>
        {lastRun && (
          <span className="text-[9px] text-muted-foreground">
            Последний запуск: {lastRun.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </SmartCard.Meta>
    </SmartCard>
  );
}
