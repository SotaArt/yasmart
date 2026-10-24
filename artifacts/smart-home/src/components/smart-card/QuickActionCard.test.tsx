import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QuickActionCard } from "./QuickActionCard";
import type { QuickAction } from "@/hooks/use-panel-config";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue({}),
  invalidateQueries: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useRunScenario: () => ({ mutate: vi.fn() }),
  useControlDevice: () => ({ mutateAsync: mocks.mutateAsync, mutate: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

beforeEach(() => {
  mocks.mutateAsync.mockClear();
  mocks.invalidateQueries.mockClear();
});

afterEach(cleanup);

async function execute(qa: QuickAction) {
  render(<QuickActionCard quickAction={qa} token="tok" size="compact" />);
  fireEvent.click(screen.getByTestId(`quick-action-${qa.id}`));
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
  return mocks.mutateAsync.mock.calls[0][0];
}

describe("QuickActionCard — payload устройства", () => {
  it("boolean-действие шлёт on_off/on", async () => {
    const payload = await execute({
      id: "qa-bool",
      name: "Включить свет",
      icon: "💡",
      actions: [{ deviceId: "light-1", instance: "on", value: true }],
    });
    expect(payload).toEqual({
      deviceId: "light-1",
      data: {
        actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: true } }],
      },
    });
  });

  it("числовое действие шлёт range с переданным instance", async () => {
    const payload = await execute({
      id: "qa-range",
      name: "Яркость",
      icon: "🔆",
      actions: [{ deviceId: "light-1", instance: "brightness", value: 30 }],
    });
    expect(payload.data.actions[0]).toEqual({
      type: "devices.capabilities.range",
      state: { instance: "brightness", value: 30 },
    });
  });

  it("выполняет несколько действий последовательно", async () => {
    await execute({
      id: "qa-multi",
      name: "Сцена",
      icon: "🎬",
      actions: [
        { deviceId: "light-1", instance: "on", value: true },
        { deviceId: "light-2", instance: "brightness", value: 10 },
      ],
    });
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2);
  });

  it.fails(
    "HIGH-баг: payload должен использовать action.instance, а не хардкодить brightness (QuickActionCard.tsx:49-54)",
    async () => {
      const payload = await execute({
        id: "qa-volume",
        name: "Громкость",
        icon: "🔊",
        actions: [{ deviceId: "media-1", instance: "volume", value: 30 }],
      });
      expect(payload.data.actions[0].state.instance).toBe("volume");
    }
  );
});
