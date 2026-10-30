import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MediaCard } from "./MediaCard";
import type { Device } from "@/lib/yandex";

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn().mockResolvedValue({}) }));

vi.mock("@workspace/api-client-react", () => ({
  useControlDevice: () => ({ mutateAsync: mocks.mutateAsync, mutate: vi.fn() }),
  getGetUserInfoQueryKey: () => ["getUserInfo"],
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: vi.fn(), invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

vi.mock("./premium", () => ({
  CardFrame: ({ top, bottom, power }: any) => (
    <div>
      {top}
      {bottom}
      <button onClick={power?.onChange}>Питание {power?.label}</button>
    </div>
  ),
  LuxButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  LuxBar: () => <div data-testid="lux-bar" />,
  CardMetric: ({ value, label }: any) => (
    <div>
      <span>{value}</span>
      <span>{label}</span>
    </div>
  ),
}));

function mediaDevice(isOn = true): Device {
  return {
    id: "media-1",
    name: "Колонка",
    type: "devices.types.media_device",
    capabilities: [
      {
        type: "devices.capabilities.on_off",
        state: { instance: "on", value: isOn },
      },
      {
        type: "devices.capabilities.mode",
        parameters: { instance: "playback" },
        state: { instance: "playback", value: "pause" },
      },
      {
        type: "devices.capabilities.range",
        parameters: { instance: "volume" },
        state: { instance: "volume", value: 40 },
      },
    ],
  };
}

beforeEach(() => mocks.mutateAsync.mockClear());
afterEach(cleanup);

async function clickPower(isOn: boolean): Promise<unknown> {
  render(<MediaCard device={mediaDevice(isOn)} token="tok" size="expanded" />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
  return mocks.mutateAsync.mock.calls[0][0].data.actions[0].state.value;
}

describe("MediaCard — управление питанием", () => {
  it("выключает включённое устройство", async () => {
    expect(await clickPower(true)).toBe(false);
  });

  it("включает выключенное устройство", async () => {
    expect(await clickPower(false)).toBe(true);
  });
});
